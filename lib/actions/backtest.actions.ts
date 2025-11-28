'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Backtest } from '@/database/models/backtest.model';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const FINNHUB_API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY || process.env.FINNHUB_API_KEY || '';

interface HistoricalCandle {
  c: number; // close
  h: number; // high
  l: number; // low
  o: number; // open
  t: number; // timestamp
  v: number; // volume
}

interface BacktestResult {
  finalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: Array<{
    date: Date;
    type: 'buy' | 'sell';
    price: number;
    quantity: number;
    reason: string;
  }>;
  equityCurve: Array<{
    date: Date;
    value: number;
  }>;
}

async function getHistoricalData(
  symbol: string,
  startDate: Date,
  endDate: Date
): Promise<HistoricalCandle[]> {
  try {
    const from = Math.floor(startDate.getTime() / 1000);
    const to = Math.floor(endDate.getTime() / 1000);
    const url = `${FINNHUB_BASE_URL}/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;

    const response = await fetch(url, { next: { revalidate: 3600 } });
    if (!response.ok) {
      throw new Error(`Failed to fetch historical data: ${response.status}`);
    }

    const data = await response.json();
    if (data.s !== 'ok') {
      throw new Error('Invalid historical data response');
    }

    const candles: HistoricalCandle[] = [];
    for (let i = 0; i < data.c.length; i++) {
      candles.push({
        c: data.c[i],
        h: data.h[i],
        l: data.l[i],
        o: data.o[i],
        t: data.t[i],
        v: data.v[i]
      });
    }

    return candles;
  } catch (error) {
    console.error('Error fetching historical data:', error);
    throw error;
  }
}

function calculateMovingAverage(prices: number[], period: number): number[] {
  const ma: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      ma.push(0);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      ma.push(sum / period);
    }
  }
  return ma;
}

function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  const changes: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      rsi.push(50); // Default neutral RSI
    } else {
      const periodChanges = changes.slice(i - period, i);
      const gains = periodChanges.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
      const losses = Math.abs(periodChanges.filter(c => c < 0).reduce((a, b) => a + b, 0)) / period;

      if (losses === 0) {
        rsi.push(100);
      } else {
        const rs = gains / losses;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }
  }

  return rsi;
}

function runBacktest(
  candles: HistoricalCandle[],
  strategy: { type: string; parameters: Record<string, any> },
  initialCapital: number
): BacktestResult {
  const prices = candles.map(c => c.c);
  let cash = initialCapital;
  let shares = 0;
  const trades: BacktestResult['trades'] = [];
  const equityCurve: BacktestResult['equityCurve'] = [];
  let peakValue = initialCapital;
  let maxDrawdown = 0;

  let maShort: number[] = [];
  let maLong: number[] = [];
  let rsi: number[] = [];

  if (strategy.type === 'moving_average') {
    const shortPeriod = strategy.parameters.shortPeriod || 10;
    const longPeriod = strategy.parameters.longPeriod || 30;
    maShort = calculateMovingAverage(prices, shortPeriod);
    maLong = calculateMovingAverage(prices, longPeriod);
  } else if (strategy.type === 'rsi') {
    const period = strategy.parameters.period || 14;
    const oversold = strategy.parameters.oversold || 30;
    const overbought = strategy.parameters.overbought || 70;
    rsi = calculateRSI(prices, period);
  }

  for (let i = 1; i < candles.length; i++) {
    const currentPrice = prices[i];
    const previousPrice = prices[i - 1];
    let shouldBuy = false;
    let shouldSell = false;
    let reason = '';

    switch (strategy.type) {
      case 'buy_and_hold':
        if (i === 1) {
          shouldBuy = true;
          reason = 'Buy and hold strategy';
        }
        break;

      case 'moving_average':
        if (i >= maLong.length - 1) {
          if (maShort[i] > maLong[i] && maShort[i - 1] <= maLong[i - 1]) {
            shouldBuy = true;
            reason = 'MA crossover: Short MA crossed above Long MA';
          } else if (maShort[i] < maLong[i] && maShort[i - 1] >= maLong[i - 1]) {
            shouldSell = true;
            reason = 'MA crossover: Short MA crossed below Long MA';
          }
        }
        break;

      case 'rsi':
        if (i >= rsi.length - 1) {
          if (rsi[i] < strategy.parameters.oversold && rsi[i - 1] >= strategy.parameters.oversold) {
            shouldBuy = true;
            reason = `RSI oversold (${rsi[i].toFixed(2)})`;
          } else if (rsi[i] > strategy.parameters.overbought && rsi[i - 1] <= strategy.parameters.overbought) {
            shouldSell = true;
            reason = `RSI overbought (${rsi[i].toFixed(2)})`;
          }
        }
        break;
    }

    // Execute buy
    if (shouldBuy && shares === 0) {
      const quantity = Math.floor(cash / currentPrice);
      if (quantity > 0) {
        const cost = quantity * currentPrice;
        cash -= cost;
        shares = quantity;
        trades.push({
          date: new Date(candles[i].t * 1000),
          type: 'buy',
          price: currentPrice,
          quantity,
          reason
        });
      }
    }

    // Execute sell
    if (shouldSell && shares > 0) {
      const proceeds = shares * currentPrice;
      cash += proceeds;
      trades.push({
        date: new Date(candles[i].t * 1000),
        type: 'sell',
        price: currentPrice,
        quantity: shares,
        reason
      });
      shares = 0;
    }

    // Calculate current portfolio value
    const currentValue = cash + (shares * currentPrice);
    equityCurve.push({
      date: new Date(candles[i].t * 1000),
      value: currentValue
    });

    // Track max drawdown
    if (currentValue > peakValue) {
      peakValue = currentValue;
    }
    const drawdown = ((peakValue - currentValue) / peakValue) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Final sell if still holding
  if (shares > 0) {
    const finalPrice = prices[prices.length - 1];
    cash += shares * finalPrice;
    trades.push({
      date: new Date(candles[candles.length - 1].t * 1000),
      type: 'sell',
      price: finalPrice,
      quantity: shares,
      reason: 'End of backtest period'
    });
    shares = 0;
  }

  const finalValue = cash;
  const totalReturn = finalValue - initialCapital;
  const totalReturnPercent = (totalReturn / initialCapital) * 100;

  // Calculate Sharpe Ratio (simplified)
  const returns = equityCurve.slice(1).map((point, i) => {
    const prevValue = equityCurve[i].value;
    return prevValue > 0 ? ((point.value - prevValue) / prevValue) * 100 : 0;
  });
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) : 0;

  return {
    finalValue,
    totalReturn,
    totalReturnPercent,
    maxDrawdown,
    sharpeRatio,
    trades,
    equityCurve
  };
}

export async function createBacktest(
  name: string,
  symbol: string,
  startDate: Date,
  endDate: Date,
  strategy: { type: string; parameters: Record<string, any> },
  initialCapital: number = 10000,
  description?: string
): Promise<{ success: boolean; message: string; backtestId?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return { success: false, message: 'Not authenticated' };
    }

    if (!FINNHUB_API_KEY) {
      return { success: false, message: 'Finnhub API key not configured' };
    }

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    // Fetch historical data
    const candles = await getHistoricalData(symbol, startDate, endDate);
    if (candles.length === 0) {
      return { success: false, message: 'No historical data available for the selected period' };
    }

    // Run backtest
    const results = runBacktest(candles, strategy, initialCapital);

    // Save backtest
    const backtest = await Backtest.create({
      userId: session.user.id,
      name,
      description,
      symbol: symbol.toUpperCase(),
      startDate,
      endDate,
      initialCapital,
      strategy,
      results
    });

    return {
      success: true,
      message: 'Backtest completed successfully',
      backtestId: backtest._id.toString()
    };
  } catch (error) {
    console.error('Error creating backtest:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create backtest'
    };
  }
}

export async function getBacktests(userId: string): Promise<Array<{
  id: string;
  name: string;
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  finalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  createdAt: Date;
}>> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const backtests = await Backtest.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return backtests.map(bt => ({
      id: bt._id.toString(),
      name: bt.name,
      symbol: bt.symbol,
      startDate: bt.startDate,
      endDate: bt.endDate,
      initialCapital: bt.initialCapital,
      finalValue: bt.results.finalValue,
      totalReturn: bt.results.totalReturn,
      totalReturnPercent: bt.results.totalReturnPercent,
      createdAt: bt.createdAt
    }));
  } catch (error) {
    console.error('Error getting backtests:', error);
    return [];
  }
}

export async function getBacktestDetails(backtestId: string): Promise<{
  id: string;
  name: string;
  description?: string;
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  results: BacktestResult;
} | null> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const backtest = await Backtest.findById(backtestId).lean();
    if (!backtest) return null;

    return {
      id: backtest._id.toString(),
      name: backtest.name,
      description: backtest.description,
      symbol: backtest.symbol,
      startDate: backtest.startDate,
      endDate: backtest.endDate,
      initialCapital: backtest.initialCapital,
      results: backtest.results
    };
  } catch (error) {
    console.error('Error getting backtest details:', error);
    return null;
  }
}

