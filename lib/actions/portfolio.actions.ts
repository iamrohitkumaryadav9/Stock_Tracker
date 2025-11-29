'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Portfolio } from '@/database/models/portfolio.model';
import { Position } from '@/database/models/position.model';
import { AdvancedPosition } from '@/database/models/advanced-position.model';
import { Transaction } from '@/database/models/transaction.model';
import { getStockQuotes } from './quote.actions';
import { getCryptoQuote, getForexQuote, getFuturesQuote, getOptionQuote } from './market-data.actions';

export interface PortfolioSummary {
  _id: string;
  name: string;
  cashBalance: number;
  totalInvested: number;
  currentValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  positions: Array<{
    assetType: 'stock' | 'crypto' | 'forex' | 'futures' | 'options';
    symbol: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    totalCost: number;
    currentValue: number;
    gainLoss: number;
    gainLossPercent: number;
    // Options specific
    optionType?: 'call' | 'put';
    strikePrice?: number;
    expirationDate?: Date;
    // Futures specific
    contractSize?: number;
    contractMonth?: string;
    // Forex specific
    baseCurrency?: string;
    quoteCurrency?: string;
  }>;
}

export async function getPortfolios(userId: string) {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const portfolios = await Portfolio.find({ userId }).sort({ createdAt: 1 });
    return JSON.parse(JSON.stringify(portfolios));
  } catch (error) {
    console.error('Error getting portfolios:', error);
    return [];
  }
}

export async function createPortfolio(userId: string, name: string) {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const portfolio = await Portfolio.create({
      userId,
      name,
      cashBalance: 100000,
      totalValue: 100000
    });

    return JSON.parse(JSON.stringify(portfolio));
  } catch (error) {
    console.error('Error creating portfolio:', error);
    return null;
  }
}

export async function getPortfolio(userId: string, portfolioId?: string): Promise<PortfolioSummary | null> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    // Get or create portfolio
    let portfolio;
    if (portfolioId) {
      portfolio = await Portfolio.findOne({ _id: portfolioId, userId });
    } else {
      // Find default or first
      portfolio = await Portfolio.findOne({ userId }).sort({ createdAt: 1 });
    }

    if (!portfolio) {
      if (!portfolioId) {
        portfolio = await Portfolio.create({
          userId,
          name: 'Main Portfolio',
          cashBalance: 100000,
          totalValue: 100000
        });
      } else {
        return null;
      }
    }

    // Get positions for this specific portfolio
    // For backward compatibility, if positions have no portfolioId, we assume they belong to the first portfolio
    const isFirstPortfolio = (await Portfolio.findOne({ userId }).sort({ createdAt: 1 }).select('_id'))?._id.toString() === portfolio._id.toString();

    const positionQuery: any = { userId };
    if (isFirstPortfolio) {
      positionQuery.$or = [{ portfolioId: portfolio._id }, { portfolioId: { $exists: false } }];
    } else {
      positionQuery.portfolioId = portfolio._id;
    }

    const [stockPositions, advancedPositions] = await Promise.all([
      Position.find(positionQuery).lean(),
      AdvancedPosition.find(positionQuery).lean()
    ]);

    if (stockPositions.length === 0 && advancedPositions.length === 0) {
      return {
        _id: portfolio._id.toString(),
        name: portfolio.name,
        cashBalance: portfolio.cashBalance,
        totalInvested: 0,
        currentValue: portfolio.cashBalance,
        totalReturn: 0,
        totalReturnPercent: 0,
        positions: []
      };
    }

    // Process stock positions (legacy)
    const stockSymbols = stockPositions.map(p => p.symbol);
    const stockQuotes = stockSymbols.length > 0 ? await getStockQuotes(stockSymbols) : new Map();

    const stockPositionDetails = stockPositions.map(position => {
      const quote = stockQuotes.get(position.symbol);
      const currentPrice = quote?.price || position.averagePrice;
      const currentValue = currentPrice * position.quantity;
      const totalCost = position.totalCost;
      const gainLoss = currentValue - totalCost;
      const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

      return {
        assetType: 'stock' as const,
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

    // Process advanced positions (crypto, forex, futures, options)
    const advancedPositionDetails = await Promise.all(
      advancedPositions.map(async (position) => {
        let currentPrice = position.averagePrice;

        try {
          switch (position.assetType) {
            case 'crypto':
              const cryptoQuote = await getCryptoQuote(position.symbol);
              currentPrice = cryptoQuote?.price || position.averagePrice;
              break;
            case 'forex':
              const forexQuote = await getForexQuote(position.symbol);
              currentPrice = forexQuote?.rate || position.averagePrice;
              break;
            case 'futures':
              const futuresQuote = await getFuturesQuote(position.symbol, position.contractMonth);
              currentPrice = futuresQuote?.price || position.averagePrice;
              break;
            case 'options':
              if (position.metadata?.underlyingSymbol && position.strikePrice && position.expirationDate) {
                const optionQuote = await getOptionQuote(
                  position.metadata.underlyingSymbol,
                  position.strikePrice,
                  position.expirationDate.toISOString(),
                  position.optionType || 'call'
                );
                currentPrice = optionQuote?.price || position.averagePrice;
              }
              break;
            case 'stock':
              const quote = stockQuotes.get(position.symbol);
              currentPrice = quote?.price || position.averagePrice;
              break;
          }
        } catch (error) {
          console.error(`Error fetching price for ${position.symbol}:`, error);
        }

        const multiplier = position.assetType === 'options' ? 100 :
          position.assetType === 'futures' ? (position.contractSize || 50) :
            position.assetType === 'forex' ? 100000 : 1;

        const currentValue = currentPrice * position.quantity * multiplier;
        const totalCost = position.totalCost;
        const gainLoss = currentValue - totalCost;
        const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

        return {
          assetType: position.assetType,
          symbol: position.symbol,
          quantity: position.quantity,
          averagePrice: position.averagePrice,
          currentPrice,
          totalCost,
          currentValue,
          gainLoss,
          gainLossPercent,
          optionType: position.optionType,
          strikePrice: position.strikePrice,
          expirationDate: position.expirationDate,
          contractSize: position.contractSize,
          contractMonth: position.contractMonth,
          baseCurrency: position.baseCurrency,
          quoteCurrency: position.quoteCurrency
        };
      })
    );

    const positionDetails = [...stockPositionDetails, ...advancedPositionDetails];

    const totalInvested = positionDetails.reduce((sum, p) => sum + p.totalCost, 0);
    const currentValue = positionDetails.reduce((sum, p) => sum + p.currentValue, 0);
    const totalPortfolioValue = portfolio.cashBalance + currentValue;
    const totalReturn = totalPortfolioValue - 100000; // Starting value was $100,000
    const totalReturnPercent = (totalReturn / 100000) * 100;

    return {
      _id: portfolio._id.toString(),
      name: portfolio.name,
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
  price: number,
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop' = 'market',
  limitPrice?: number,
  stopPrice?: number,
  portfolioId?: string
): Promise<{ success: boolean; message: string; portfolio?: PortfolioSummary }> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const totalAmount = quantity * price;

    // Get or create portfolio
    let portfolio;
    if (portfolioId) {
      portfolio = await Portfolio.findOne({ _id: portfolioId, userId });
    } else {
      portfolio = await Portfolio.findOne({ userId }).sort({ createdAt: 1 });
    }

    if (!portfolio) {
      if (!portfolioId) {
        portfolio = await Portfolio.create({
          userId,
          name: 'Main Portfolio',
          cashBalance: 100000,
          totalValue: 100000
        });
      } else {
        return {
          success: false,
          message: 'Portfolio not found'
        };
      }
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
      const existingPosition = await Position.findOne({ userId, portfolioId: portfolio._id, symbol });
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
          portfolioId: portfolio._id,
          symbol: symbol.toUpperCase(),
          quantity,
          averagePrice: price,
          totalCost: totalAmount
        });
      }
    } else {
      // Sell
      // Try to find position in specific portfolio first
      let position = await Position.findOne({ userId, portfolioId: portfolio._id, symbol: symbol.toUpperCase() });

      // Fallback for legacy positions if this is the main portfolio
      if (!position) {
        const isFirstPortfolio = (await Portfolio.findOne({ userId }).sort({ createdAt: 1 }).select('_id'))?._id.toString() === portfolio._id.toString();
        if (isFirstPortfolio) {
          position = await Position.findOne({ userId, symbol: symbol.toUpperCase(), portfolioId: { $exists: false } });
        }
      }

      if (!position) {
        return {
          success: false,
          message: `You don't own any shares of ${symbol} in this portfolio`
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
        // Ensure portfolioId is set if it was missing
        if (!position.portfolioId) {
          position.portfolioId = portfolio._id;
        }
        await position.save();
      }
    }

    // Record transaction
    const transaction = await Transaction.create({
      userId,
      assetType: 'stock',
      symbol: symbol.toUpperCase(),
      type,
      quantity,
      price,
      totalAmount,
      orderType,
      limitPrice,
      stopPrice,
      status: 'filled', // Simulating immediate fill for paper trading
      timestamp: new Date()
    });

    // Handle copy trading (import dynamically to avoid circular dependency)
    try {
      const { handleCopyTrading } = await import('./advanced-trading.actions');
      await handleCopyTrading(userId, transaction._id.toString(), 'stock', symbol.toUpperCase(), type, quantity, price);
    } catch (error) {
      console.error('Error handling copy trading:', error);
      // Don't fail the trade if copy trading fails
    }

    // Get updated portfolio
    const updatedPortfolio = await getPortfolio(userId, portfolio._id.toString());

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
  assetType: 'stock' | 'crypto' | 'forex' | 'futures' | 'options';
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  totalAmount: number;
  timestamp: Date;
  isCopied?: boolean;
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
      assetType: (t.assetType || 'stock') as 'stock' | 'crypto' | 'forex' | 'futures' | 'options',
      symbol: t.symbol,
      type: t.type,
      quantity: t.quantity,
      price: t.price,
      totalAmount: t.totalAmount,
      timestamp: t.timestamp,
      isCopied: t.isCopied || false
    }));
  } catch (error) {
    console.error('Error getting transaction history:', error);
    return [];
  }
}
