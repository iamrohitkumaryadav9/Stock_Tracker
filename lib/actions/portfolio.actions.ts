'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Portfolio } from '@/database/models/portfolio.model';
import { Position } from '@/database/models/position.model';
import { Transaction } from '@/database/models/transaction.model';
import { getStockQuotes } from './quote.actions';

export interface PortfolioSummary {
  cashBalance: number;
  totalInvested: number;
  currentValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  positions: Array<{
    symbol: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    totalCost: number;
    currentValue: number;
    gainLoss: number;
    gainLossPercent: number;
  }>;
}

export async function getPortfolio(userId: string): Promise<PortfolioSummary | null> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    // Get or create portfolio
    let portfolio = await Portfolio.findOne({ userId });
    if (!portfolio) {
      portfolio = await Portfolio.create({
        userId,
        cashBalance: 100000,
        totalValue: 100000
      });
    }

    // Get all positions
    const positions = await Position.find({ userId }).lean();

    if (positions.length === 0) {
      return {
        cashBalance: portfolio.cashBalance,
        totalInvested: 0,
        currentValue: portfolio.cashBalance,
        totalReturn: 0,
        totalReturnPercent: 0,
        positions: []
      };
    }

    // Get current prices for all positions
    const symbols = positions.map(p => p.symbol);
    const quotes = await getStockQuotes(symbols);

    // Calculate position values
    const positionDetails = positions.map(position => {
      const quote = quotes.get(position.symbol);
      const currentPrice = quote?.price || position.averagePrice;
      const currentValue = currentPrice * position.quantity;
      const totalCost = position.totalCost;
      const gainLoss = currentValue - totalCost;
      const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

      return {
        symbol: position.symbol,
        quantity: position.quantity,
        averagePrice: position.averagePrice,
        currentPrice,
        totalCost,
        currentValue,
        gainLoss,
        gainLossPercent
      };
    });

    const totalInvested = positionDetails.reduce((sum, p) => sum + p.totalCost, 0);
    const currentValue = positionDetails.reduce((sum, p) => sum + p.currentValue, 0);
    const totalPortfolioValue = portfolio.cashBalance + currentValue;
    const totalReturn = totalPortfolioValue - 100000; // Starting value was $100,000
    const totalReturnPercent = (totalReturn / 100000) * 100;

    return {
      cashBalance: portfolio.cashBalance,
      totalInvested,
      currentValue,
      totalReturn,
      totalReturnPercent,
      positions: positionDetails
    };
  } catch (error) {
    console.error('Error getting portfolio:', error);
    return null;
  }
}

export async function executeTrade(
  userId: string,
  symbol: string,
  type: 'buy' | 'sell',
  quantity: number,
  price: number
): Promise<{ success: boolean; message: string; portfolio?: PortfolioSummary }> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const totalAmount = quantity * price;

    // Get or create portfolio
    let portfolio = await Portfolio.findOne({ userId });
    if (!portfolio) {
      portfolio = await Portfolio.create({
        userId,
        cashBalance: 100000,
        totalValue: 100000
      });
    }

    if (type === 'buy') {
      // Check if user has enough cash
      if (portfolio.cashBalance < totalAmount) {
        return {
          success: false,
          message: `Insufficient funds. You need $${totalAmount.toFixed(2)} but only have $${portfolio.cashBalance.toFixed(2)}`
        };
      }

      // Update cash balance
      portfolio.cashBalance -= totalAmount;
      await portfolio.save();

      // Update or create position
      const existingPosition = await Position.findOne({ userId, symbol });
      if (existingPosition) {
        // Calculate new average price
        const newTotalCost = existingPosition.totalCost + totalAmount;
        const newQuantity = existingPosition.quantity + quantity;
        const newAveragePrice = newTotalCost / newQuantity;

        existingPosition.quantity = newQuantity;
        existingPosition.averagePrice = newAveragePrice;
        existingPosition.totalCost = newTotalCost;
        await existingPosition.save();
      } else {
        await Position.create({
          userId,
          symbol: symbol.toUpperCase(),
          quantity,
          averagePrice: price,
          totalCost: totalAmount
        });
      }
    } else {
      // Sell
      const position = await Position.findOne({ userId, symbol: symbol.toUpperCase() });
      if (!position) {
        return {
          success: false,
          message: `You don't own any shares of ${symbol}`
        };
      }

      if (position.quantity < quantity) {
        return {
          success: false,
          message: `Insufficient shares. You own ${position.quantity} shares but trying to sell ${quantity}`
        };
      }

      // Update cash balance
      portfolio.cashBalance += totalAmount;
      await portfolio.save();

      // Update position
      if (position.quantity === quantity) {
        // Selling all shares, delete position
        await Position.deleteOne({ _id: position._id });
      } else {
        // Partial sale - reduce quantity and adjust average price
        position.quantity -= quantity;
        // For simplicity, we keep the average price the same (FIFO would be more accurate)
        position.totalCost = position.averagePrice * position.quantity;
        await position.save();
      }
    }

    // Record transaction
    await Transaction.create({
      userId,
      symbol: symbol.toUpperCase(),
      type,
      quantity,
      price,
      totalAmount,
      timestamp: new Date()
    });

    // Get updated portfolio
    const updatedPortfolio = await getPortfolio(userId);

    return {
      success: true,
      message: `Successfully ${type === 'buy' ? 'bought' : 'sold'} ${quantity} shares of ${symbol} at $${price.toFixed(2)}`,
      portfolio: updatedPortfolio || undefined
    };
  } catch (error) {
    console.error('Error executing trade:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to execute trade'
    };
  }
}

export async function getTransactionHistory(
  userId: string,
  limit: number = 50
): Promise<Array<{
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  totalAmount: number;
  timestamp: Date;
}>> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const transactions = await Transaction.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return transactions.map(t => ({
      symbol: t.symbol,
      type: t.type,
      quantity: t.quantity,
      price: t.price,
      totalAmount: t.totalAmount,
      timestamp: t.timestamp
    }));
  } catch (error) {
    console.error('Error getting transaction history:', error);
    return [];
  }
}

