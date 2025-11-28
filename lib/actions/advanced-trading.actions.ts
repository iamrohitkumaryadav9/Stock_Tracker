'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Portfolio } from '@/database/models/portfolio.model';
import { AdvancedPosition } from '@/database/models/advanced-position.model';
import { Transaction } from '@/database/models/transaction.model';
import { CopyTrade, CopiedTrade } from '@/database/models/copy-trading.model';
import { 
  getCryptoQuote, 
  getForexQuote, 
  getFuturesQuote, 
  getOptionQuote 
} from './market-data.actions';
import { getStockQuote } from './quote.actions';

// ==================== OPTIONS TRADING ====================

export interface OptionsTradeParams {
  userId: string;
  underlyingSymbol: string;
  strikePrice: number;
  expirationDate: string; // ISO date string
  optionType: 'call' | 'put';
  quantity: number;
  type: 'buy' | 'sell';
}

export async function executeOptionsTrade(params: OptionsTradeParams): Promise<{
  success: boolean;
  message: string;
  transactionId?: string;
}> {
  try {
    const { userId, underlyingSymbol, strikePrice, expirationDate, optionType, quantity, type } = params;
    
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    // Get option quote
    const optionQuote = await getOptionQuote(underlyingSymbol, strikePrice, expirationDate, optionType);
    if (!optionQuote) {
      return { success: false, message: 'Unable to fetch option quote' };
    }

    const premium = optionQuote.price;
    const totalAmount = quantity * premium * 100; // Options are typically 100 shares per contract

    // Get or create portfolio
    let portfolio = await Portfolio.findOne({ userId });
    if (!portfolio) {
      portfolio = await Portfolio.create({
        userId,
        cashBalance: 100000,
        totalValue: 100000
      });
    }

    const symbol = `${underlyingSymbol}${expirationDate.replace(/-/g, '')}${optionType === 'call' ? 'C' : 'P'}${strikePrice}`;

    if (type === 'buy') {
      if (portfolio.cashBalance < totalAmount) {
        return {
          success: false,
          message: `Insufficient funds. You need $${totalAmount.toFixed(2)} but only have $${portfolio.cashBalance.toFixed(2)}`
        };
      }

      portfolio.cashBalance -= totalAmount;
      await portfolio.save();

      // Update or create position
      const existingPosition = await AdvancedPosition.findOne({
        userId,
        assetType: 'options',
        symbol,
        strikePrice,
        expirationDate: new Date(expirationDate)
      });

      if (existingPosition) {
        const newTotalCost = existingPosition.totalCost + totalAmount;
        const newQuantity = existingPosition.quantity + quantity;
        const newAveragePrice = newTotalCost / (newQuantity * 100);

        existingPosition.quantity = newQuantity;
        existingPosition.averagePrice = newAveragePrice;
        existingPosition.totalCost = newTotalCost;
        await existingPosition.save();
      } else {
        await AdvancedPosition.create({
          userId,
          assetType: 'options',
          symbol,
          quantity,
          averagePrice: premium,
          totalCost: totalAmount,
          optionType,
          strikePrice,
          expirationDate: new Date(expirationDate),
          metadata: { underlyingSymbol }
        });
      }
    } else {
      // Sell
      const position = await AdvancedPosition.findOne({
        userId,
        assetType: 'options',
        symbol,
        strikePrice,
        expirationDate: new Date(expirationDate)
      });

      if (!position) {
        return { success: false, message: `You don't own any ${optionType} options for ${underlyingSymbol} at strike $${strikePrice}` };
      }

      if (position.quantity < quantity) {
        return {
          success: false,
          message: `Insufficient contracts. You own ${position.quantity} contracts but trying to sell ${quantity}`
        };
      }

      portfolio.cashBalance += totalAmount;
      await portfolio.save();

      if (position.quantity === quantity) {
        await AdvancedPosition.deleteOne({ _id: position._id });
      } else {
        position.quantity -= quantity;
        position.totalCost = position.averagePrice * position.quantity * 100;
        await position.save();
      }
    }

    // Record transaction
    const transaction = await Transaction.create({
      userId,
      assetType: 'options',
      symbol,
      type,
      quantity,
      price: premium,
      totalAmount,
      optionType,
      strikePrice,
      expirationDate: new Date(expirationDate),
      timestamp: new Date()
    });

    // Handle copy trading
    await handleCopyTrading(userId, transaction._id.toString(), 'options', symbol, type, quantity, premium);

    return {
      success: true,
      message: `Successfully ${type === 'buy' ? 'bought' : 'sold'} ${quantity} ${optionType} option contracts of ${underlyingSymbol} at $${premium.toFixed(2)} per contract`,
      transactionId: transaction._id.toString()
    };
  } catch (error) {
    console.error('Error executing options trade:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to execute options trade'
    };
  }
}

// ==================== CRYPTO TRADING ====================

export interface CryptoTradeParams {
  userId: string;
  symbol: string; // e.g., "BTC", "ETH"
  quantity: number;
  type: 'buy' | 'sell';
}

export async function executeCryptoTrade(params: CryptoTradeParams): Promise<{
  success: boolean;
  message: string;
  transactionId?: string;
}> {
  try {
    const { userId, symbol, quantity, type } = params;
    
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    // Get crypto quote
    const quote = await getCryptoQuote(symbol);
    if (!quote) {
      return { success: false, message: `Unable to fetch price for ${symbol}` };
    }

    const price = quote.price;
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
      if (portfolio.cashBalance < totalAmount) {
        return {
          success: false,
          message: `Insufficient funds. You need $${totalAmount.toFixed(2)} but only have $${portfolio.cashBalance.toFixed(2)}`
        };
      }

      portfolio.cashBalance -= totalAmount;
      await portfolio.save();

      // Update or create position
      const existingPosition = await AdvancedPosition.findOne({
        userId,
        assetType: 'crypto',
        symbol: symbol.toUpperCase()
      });

      if (existingPosition) {
        const newTotalCost = existingPosition.totalCost + totalAmount;
        const newQuantity = existingPosition.quantity + quantity;
        const newAveragePrice = newTotalCost / newQuantity;

        existingPosition.quantity = newQuantity;
        existingPosition.averagePrice = newAveragePrice;
        existingPosition.totalCost = newTotalCost;
        await existingPosition.save();
      } else {
        await AdvancedPosition.create({
          userId,
          assetType: 'crypto',
          symbol: symbol.toUpperCase(),
          quantity,
          averagePrice: price,
          totalCost: totalAmount
        });
      }
    } else {
      // Sell
      const position = await AdvancedPosition.findOne({
        userId,
        assetType: 'crypto',
        symbol: symbol.toUpperCase()
      });

      if (!position) {
        return { success: false, message: `You don't own any ${symbol}` };
      }

      if (position.quantity < quantity) {
        return {
          success: false,
          message: `Insufficient holdings. You own ${position.quantity} ${symbol} but trying to sell ${quantity}`
        };
      }

      portfolio.cashBalance += totalAmount;
      await portfolio.save();

      if (position.quantity === quantity) {
        await AdvancedPosition.deleteOne({ _id: position._id });
      } else {
        position.quantity -= quantity;
        position.totalCost = position.averagePrice * position.quantity;
        await position.save();
      }
    }

    // Record transaction
    const transaction = await Transaction.create({
      userId,
      assetType: 'crypto',
      symbol: symbol.toUpperCase(),
      type,
      quantity,
      price,
      totalAmount,
      timestamp: new Date()
    });

    // Handle copy trading
    await handleCopyTrading(userId, transaction._id.toString(), 'crypto', symbol.toUpperCase(), type, quantity, price);

    return {
      success: true,
      message: `Successfully ${type === 'buy' ? 'bought' : 'sold'} ${quantity} ${symbol} at $${price.toFixed(2)}`,
      transactionId: transaction._id.toString()
    };
  } catch (error) {
    console.error('Error executing crypto trade:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to execute crypto trade'
    };
  }
}

// ==================== FOREX TRADING ====================

export interface ForexTradeParams {
  userId: string;
  pair: string; // e.g., "EUR/USD"
  quantity: number; // Lot size (1 lot = 100,000 units)
  type: 'buy' | 'sell';
}

export async function executeForexTrade(params: ForexTradeParams): Promise<{
  success: boolean;
  message: string;
  transactionId?: string;
}> {
  try {
    const { userId, pair, quantity, type } = params;
    
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    // Get forex quote
    const quote = await getForexQuote(pair);
    if (!quote) {
      return { success: false, message: `Unable to fetch quote for ${pair}` };
    }

    const [baseCurrency, quoteCurrency] = pair.split('/');
    const lotSize = 100000; // Standard lot size
    const totalAmount = quantity * lotSize * quote.rate;

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
      if (portfolio.cashBalance < totalAmount) {
        return {
          success: false,
          message: `Insufficient funds. You need $${totalAmount.toFixed(2)} but only have $${portfolio.cashBalance.toFixed(2)}`
        };
      }

      portfolio.cashBalance -= totalAmount;
      await portfolio.save();

      // Update or create position
      const existingPosition = await AdvancedPosition.findOne({
        userId,
        assetType: 'forex',
        symbol: pair.toUpperCase()
      });

      if (existingPosition) {
        const newTotalCost = existingPosition.totalCost + totalAmount;
        const newQuantity = existingPosition.quantity + quantity;
        const newAveragePrice = newTotalCost / (newQuantity * lotSize);

        existingPosition.quantity = newQuantity;
        existingPosition.averagePrice = newAveragePrice;
        existingPosition.totalCost = newTotalCost;
        await existingPosition.save();
      } else {
        await AdvancedPosition.create({
          userId,
          assetType: 'forex',
          symbol: pair.toUpperCase(),
          quantity,
          averagePrice: quote.rate,
          totalCost: totalAmount,
          baseCurrency,
          quoteCurrency
        });
      }
    } else {
      // Sell
      const position = await AdvancedPosition.findOne({
        userId,
        assetType: 'forex',
        symbol: pair.toUpperCase()
      });

      if (!position) {
        return { success: false, message: `You don't own any ${pair} positions` };
      }

      if (position.quantity < quantity) {
        return {
          success: false,
          message: `Insufficient lots. You own ${position.quantity} lots but trying to sell ${quantity}`
        };
      }

      portfolio.cashBalance += totalAmount;
      await portfolio.save();

      if (position.quantity === quantity) {
        await AdvancedPosition.deleteOne({ _id: position._id });
      } else {
        position.quantity -= quantity;
        position.totalCost = position.averagePrice * position.quantity * lotSize;
        await position.save();
      }
    }

    // Record transaction
    const transaction = await Transaction.create({
      userId,
      assetType: 'forex',
      symbol: pair.toUpperCase(),
      type,
      quantity,
      price: quote.rate,
      totalAmount,
      baseCurrency,
      quoteCurrency,
      timestamp: new Date()
    });

    // Handle copy trading
    await handleCopyTrading(userId, transaction._id.toString(), 'forex', pair.toUpperCase(), type, quantity, quote.rate);

    return {
      success: true,
      message: `Successfully ${type === 'buy' ? 'bought' : 'sold'} ${quantity} lots of ${pair} at ${quote.rate.toFixed(5)}`,
      transactionId: transaction._id.toString()
    };
  } catch (error) {
    console.error('Error executing forex trade:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to execute forex trade'
    };
  }
}

// ==================== FUTURES TRADING ====================

export interface FuturesTradeParams {
  userId: string;
  symbol: string; // e.g., "ES" for E-mini S&P 500
  contractMonth: string; // e.g., "2024-03"
  quantity: number; // Number of contracts
  type: 'buy' | 'sell';
}

export async function executeFuturesTrade(params: FuturesTradeParams): Promise<{
  success: boolean;
  message: string;
  transactionId?: string;
}> {
  try {
    const { userId, symbol, contractMonth, quantity, type } = params;
    
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    // Get futures quote
    const quote = await getFuturesQuote(symbol, contractMonth);
    if (!quote) {
      return { success: false, message: `Unable to fetch quote for ${symbol}` };
    }

    const contractSize = quote.contractSize || 50;
    const totalAmount = quantity * quote.price * contractSize;

    // Get or create portfolio
    let portfolio = await Portfolio.findOne({ userId });
    if (!portfolio) {
      portfolio = await Portfolio.create({
        userId,
        cashBalance: 100000,
        totalValue: 100000
      });
    }

    const positionSymbol = `${symbol}-${contractMonth}`;

    if (type === 'buy') {
      if (portfolio.cashBalance < totalAmount) {
        return {
          success: false,
          message: `Insufficient funds. You need $${totalAmount.toFixed(2)} but only have $${portfolio.cashBalance.toFixed(2)}`
        };
      }

      portfolio.cashBalance -= totalAmount;
      await portfolio.save();

      // Update or create position
      const existingPosition = await AdvancedPosition.findOne({
        userId,
        assetType: 'futures',
        symbol: positionSymbol.toUpperCase(),
        contractMonth
      });

      if (existingPosition) {
        const newTotalCost = existingPosition.totalCost + totalAmount;
        const newQuantity = existingPosition.quantity + quantity;
        const newAveragePrice = newTotalCost / (newQuantity * contractSize);

        existingPosition.quantity = newQuantity;
        existingPosition.averagePrice = newAveragePrice;
        existingPosition.totalCost = newTotalCost;
        await existingPosition.save();
      } else {
        await AdvancedPosition.create({
          userId,
          assetType: 'futures',
          symbol: positionSymbol.toUpperCase(),
          quantity,
          averagePrice: quote.price,
          totalCost: totalAmount,
          contractSize,
          contractMonth
        });
      }
    } else {
      // Sell
      const position = await AdvancedPosition.findOne({
        userId,
        assetType: 'futures',
        symbol: positionSymbol.toUpperCase(),
        contractMonth
      });

      if (!position) {
        return { success: false, message: `You don't own any ${symbol} futures contracts` };
      }

      if (position.quantity < quantity) {
        return {
          success: false,
          message: `Insufficient contracts. You own ${position.quantity} contracts but trying to sell ${quantity}`
        };
      }

      portfolio.cashBalance += totalAmount;
      await portfolio.save();

      if (position.quantity === quantity) {
        await AdvancedPosition.deleteOne({ _id: position._id });
      } else {
        position.quantity -= quantity;
        position.totalCost = position.averagePrice * position.quantity * contractSize;
        await position.save();
      }
    }

    // Record transaction
    const transaction = await Transaction.create({
      userId,
      assetType: 'futures',
      symbol: positionSymbol.toUpperCase(),
      type,
      quantity,
      price: quote.price,
      totalAmount,
      contractSize,
      contractMonth,
      timestamp: new Date()
    });

    // Handle copy trading
    await handleCopyTrading(userId, transaction._id.toString(), 'futures', positionSymbol.toUpperCase(), type, quantity, quote.price);

    return {
      success: true,
      message: `Successfully ${type === 'buy' ? 'bought' : 'sold'} ${quantity} ${symbol} futures contracts at $${quote.price.toFixed(2)}`,
      transactionId: transaction._id.toString()
    };
  } catch (error) {
    console.error('Error executing futures trade:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to execute futures trade'
    };
  }
}

// ==================== COPY TRADING ====================

export async function followTrader(
  followerId: string,
  traderId: string,
  copyPercentage: number = 100,
  maxPositionSize?: number,
  assetTypes: ('stock' | 'crypto' | 'forex' | 'futures' | 'options')[] = ['stock']
): Promise<{ success: boolean; message: string }> {
  try {
    if (followerId === traderId) {
      return { success: false, message: 'Cannot copy yourself' };
    }

    if (copyPercentage < 0 || copyPercentage > 100) {
      return { success: false, message: 'Copy percentage must be between 0 and 100' };
    }

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const existingFollow = await CopyTrade.findOne({ followerId, traderId });

    if (existingFollow) {
      existingFollow.isActive = true;
      existingFollow.copyPercentage = copyPercentage;
      existingFollow.maxPositionSize = maxPositionSize;
      existingFollow.assetTypes = assetTypes;
      await existingFollow.save();
      return { success: true, message: 'Copy trading settings updated' };
    } else {
      await CopyTrade.create({
        followerId,
        traderId,
        isActive: true,
        copyPercentage,
        maxPositionSize,
        assetTypes
      });
      return { success: true, message: 'Now copying this trader' };
    }
  } catch (error) {
    console.error('Error following trader:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to follow trader'
    };
  }
}

export async function unfollowTrader(
  followerId: string,
  traderId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const copyTrade = await CopyTrade.findOne({ followerId, traderId });
    if (!copyTrade) {
      return { success: false, message: 'Not following this trader' };
    }

    copyTrade.isActive = false;
    await copyTrade.save();

    return { success: true, message: 'Stopped copying this trader' };
  } catch (error) {
    console.error('Error unfollowing trader:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to unfollow trader'
    };
  }
}

export async function getCopyTradingList(userId: string): Promise<Array<{
  traderId: string;
  traderName?: string;
  copyPercentage: number;
  isActive: boolean;
  assetTypes: string[];
}>> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const copyTrades = await CopyTrade.find({ followerId: userId }).lean();
    
    // TODO: Fetch trader names from user database
    return copyTrades.map(ct => ({
      traderId: ct.traderId,
      copyPercentage: ct.copyPercentage,
      isActive: ct.isActive,
      assetTypes: ct.assetTypes
    }));
  } catch (error) {
    console.error('Error getting copy trading list:', error);
    return [];
  }
}

// Helper function to handle copy trading when a trade is executed
export async function handleCopyTrading(
  traderId: string,
  transactionId: string,
  assetType: 'stock' | 'crypto' | 'forex' | 'futures' | 'options',
  symbol: string,
  type: 'buy' | 'sell',
  quantity: number,
  price: number
): Promise<void> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) return;

    // Find all active copy trades for this trader
    const copyTrades = await CopyTrade.find({
      traderId,
      isActive: true,
      assetTypes: assetType
    }).lean();

    for (const copyTrade of copyTrades) {
      try {
        // Calculate copied quantity based on percentage
        const copiedQuantity = Math.floor(quantity * (copyTrade.copyPercentage / 100));
        
        if (copiedQuantity <= 0) continue;

        // Check max position size if set
        const totalAmount = copiedQuantity * price;
        if (copyTrade.maxPositionSize && totalAmount > copyTrade.maxPositionSize) {
          continue; // Skip if exceeds max position size
        }

        // Execute the copied trade based on asset type
        let result;
        switch (assetType) {
          case 'stock':
            const { executeTrade } = await import('./portfolio.actions');
            result = await executeTrade(
              copyTrade.followerId,
              symbol,
              type,
              copiedQuantity,
              price
            );
            break;
          case 'crypto':
            result = await executeCryptoTrade({
              userId: copyTrade.followerId,
              symbol,
              quantity: copiedQuantity,
              type
            });
            break;
          case 'forex':
            const [base, quote] = symbol.split('/');
            if (base && quote) {
              result = await executeForexTrade({
                userId: copyTrade.followerId,
                pair: symbol,
                quantity: copiedQuantity,
                type
              });
            }
            break;
          case 'futures':
            // Extract contract month from symbol if available
            const parts = symbol.split('-');
            const futuresSymbol = parts[0];
            const contractMonth = parts[1] || new Date().toISOString().slice(0, 7);
            result = await executeFuturesTrade({
              userId: copyTrade.followerId,
              symbol: futuresSymbol,
              contractMonth,
              quantity: copiedQuantity,
              type
            });
            break;
          case 'options':
            // Options require more complex parsing - skip for now
            continue;
        }

        if (result?.success && result.transactionId) {
          // Record the copy trade
          await CopiedTrade.create({
            followerId: copyTrade.followerId,
            traderId,
            originalTransactionId: transactionId,
            copiedTransactionId: result.transactionId,
            assetType,
            symbol,
            copyPercentage: copyTrade.copyPercentage,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error(`Error copying trade for follower ${copyTrade.followerId}:`, error);
        // Continue with other followers even if one fails
      }
    }
  } catch (error) {
    console.error('Error handling copy trading:', error);
    // Don't throw - copy trading failure shouldn't break the original trade
  }
}

