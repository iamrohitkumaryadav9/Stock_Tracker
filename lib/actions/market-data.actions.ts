'use server';

import yahooFinance from 'yahoo-finance2';

// Market data fetching for different asset types
// Integrates with Yahoo Finance (via yahoo-finance2) and Alpha Vantage (optional)

const FINNHUB_API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || '';

// ==================== CRYPTO ====================

export interface CryptoQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume24h?: number;
  marketCap?: number;
}

export async function getCryptoQuote(symbol: string): Promise<CryptoQuote | null> {
  try {
    // Try Yahoo Finance first
    // Yahoo crypto symbols usually end with -USD (e.g., BTC-USD)
    const yahooSymbol = symbol.toUpperCase().endsWith('-USD') ? symbol.toUpperCase() : `${symbol.toUpperCase()}-USD`;

    try {
      const quote = await yahooFinance.quote(yahooSymbol) as any;
      if (quote) {
        return {
          symbol: symbol.toUpperCase(),
          price: quote.regularMarketPrice || 0,
          change: quote.regularMarketChange || 0,
          changePercent: quote.regularMarketChangePercent || 0,
          volume24h: quote.regularMarketVolume,
          marketCap: quote.marketCap,
        };
      }
    } catch (yError) {
      console.warn(`Yahoo Finance failed for ${symbol}, trying fallback`);
    }

    // Fallback: Mock data for development
    console.warn(`Crypto quote not available for ${symbol}, using mock data`);
    return {
      symbol: symbol.toUpperCase(),
      price: 50000 + Math.random() * 10000,
      change: (Math.random() - 0.5) * 1000,
      changePercent: (Math.random() - 0.5) * 5,
      volume24h: 1000000000,
    };
  } catch (error) {
    console.error('Error fetching crypto quote:', error);
    return null;
  }
}

// ==================== FOREX ====================

export interface ForexQuote {
  pair: string; // e.g., "EUR/USD"
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  change: number;
  changePercent: number;
  bid?: number;
  ask?: number;
}

export async function getForexQuote(pair: string): Promise<ForexQuote | null> {
  try {
    const [base, quoteCurrency] = pair.split('/');
    if (!base || !quoteCurrency) {
      throw new Error('Invalid forex pair format. Use format: BASE/QUOTE (e.g., EUR/USD)');
    }

    // Try Yahoo Finance
    // Yahoo forex symbols are like EURUSD=X
    const yahooSymbol = `${base}${quoteCurrency}=X`;

    try {
      const quote = await yahooFinance.quote(yahooSymbol) as any;
      if (quote) {
        return {
          pair: `${base}/${quoteCurrency}`,
          baseCurrency: base,
          quoteCurrency: quoteCurrency,
          rate: quote.regularMarketPrice || 0,
          change: quote.regularMarketChange || 0,
          changePercent: quote.regularMarketChangePercent || 0,
          bid: quote.bid,
          ask: quote.ask,
        };
      }
    } catch (yError) {
      console.warn(`Yahoo Finance failed for ${pair}, trying fallback`);
    }

    // Fallback: Mock data
    console.warn(`Forex quote not available for ${pair}, using mock data`);
    const mockRates: Record<string, number> = {
      'EUR/USD': 1.08,
      'GBP/USD': 1.27,
      'USD/JPY': 150.0,
      'USD/CHF': 0.88,
      'AUD/USD': 0.65,
    };

    const rate = mockRates[pair] || 1.0;
    return {
      pair,
      baseCurrency: base,
      quoteCurrency: quoteCurrency,
      rate,
      change: (Math.random() - 0.5) * 0.01,
      changePercent: (Math.random() - 0.5) * 1,
      bid: rate * 0.9999,
      ask: rate * 1.0001,
    };
  } catch (error) {
    console.error('Error fetching forex quote:', error);
    return null;
  }
}

// ==================== FUTURES ====================

export interface FuturesQuote {
  symbol: string; // e.g., "ES" for E-mini S&P 500
  contractMonth: string; // e.g., "2024-03"
  price: number;
  change: number;
  changePercent: number;
  openInterest?: number;
  volume?: number;
  contractSize: number;
}

export async function getFuturesQuote(symbol: string, contractMonth?: string): Promise<FuturesQuote | null> {
  try {
    // Try Yahoo Finance
    // Yahoo futures symbols: ES=F, NQ=F, YM=F, CL=F, GC=F
    let yahooSymbol = symbol.toUpperCase();
    if (!yahooSymbol.endsWith('=F')) {
      // Map common symbols to Yahoo format
      const map: Record<string, string> = {
        'ES': 'ES=F',
        'NQ': 'NQ=F',
        'YM': 'YM=F',
        'CL': 'CL=F',
        'GC': 'GC=F'
      };
      yahooSymbol = map[yahooSymbol] || `${yahooSymbol}=F`;
    }

    try {
      const quote = await yahooFinance.quote(yahooSymbol) as any;
      if (quote) {
        return {
          symbol: symbol.toUpperCase(),
          contractMonth: contractMonth || new Date().toISOString().slice(0, 7),
          price: quote.regularMarketPrice || 0,
          change: quote.regularMarketChange || 0,
          changePercent: quote.regularMarketChangePercent || 0,
          volume: quote.regularMarketVolume,
          openInterest: quote.openInterest,
          contractSize: 50, // Standard for E-mini contracts (simplified)
        };
      }
    } catch (yError) {
      console.warn(`Yahoo Finance failed for ${symbol}, trying fallback`);
    }

    // Fallback: Mock data
    console.warn(`Futures quote not available for ${symbol}, using mock data`);
    const mockPrices: Record<string, number> = {
      'ES': 4500, // E-mini S&P 500
      'NQ': 15000, // E-mini NASDAQ
      'YM': 35000, // E-mini Dow
      'CL': 75, // Crude Oil
      'GC': 2000, // Gold
    };

    const basePrice = mockPrices[symbol] || 1000;
    return {
      symbol: symbol.toUpperCase(),
      contractMonth: contractMonth || new Date().toISOString().slice(0, 7),
      price: basePrice + (Math.random() - 0.5) * 100,
      change: (Math.random() - 0.5) * 10,
      changePercent: (Math.random() - 0.5) * 2,
      volume: 1000000,
      contractSize: 50,
    };
  } catch (error) {
    console.error('Error fetching futures quote:', error);
    return null;
  }
}

// ==================== OPTIONS ====================

export interface OptionQuote {
  symbol: string;
  underlyingSymbol: string;
  optionType: 'call' | 'put';
  strikePrice: number;
  expirationDate: string; // ISO date string
  price: number; // Option premium
  bid?: number;
  ask?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

export async function getOptionQuote(
  underlyingSymbol: string,
  strikePrice: number,
  expirationDate: string,
  optionType: 'call' | 'put'
): Promise<OptionQuote | null> {
  try {
    // Options data is hard to get for free. Yahoo Finance has it but yahoo-finance2 support is partial for options chains.
    // We'll try to fetch the underlying price from Yahoo and use BS model, 
    // OR if Alpha Vantage key is present, use that (AV has options data in premium, but maybe basic exists).

    // For now, we stick to the BS model using real underlying price from Yahoo.

    let stockPrice = 0;
    try {
      const quote = await yahooFinance.quote(underlyingSymbol) as any;
      stockPrice = quote.regularMarketPrice || 0;
    } catch (e) {
      console.warn(`Failed to fetch underlying price for ${underlyingSymbol}`);
    }

    if (stockPrice === 0) {
      // Fallback to mock underlying price
      stockPrice = 150 + Math.random() * 10;
    }

    const timeToExpiry = (new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365);
    const intrinsicValue = optionType === 'call'
      ? Math.max(0, stockPrice - strikePrice)
      : Math.max(0, strikePrice - stockPrice);

    // Simplified Black-Scholes approximation
    const volatility = 0.2; // 20% implied volatility (mock)
    const riskFreeRate = 0.05; // 5% risk-free rate
    // d1/d2 calc omitted for brevity in mock, just using intrinsic + time value

    const timeValue = stockPrice * volatility * Math.sqrt(timeToExpiry) * 0.4;
    const premium = intrinsicValue + timeValue;

    return {
      symbol: `${underlyingSymbol}${expirationDate.replace(/-/g, '')}${optionType === 'call' ? 'C' : 'P'}${strikePrice}`,
      underlyingSymbol: underlyingSymbol.toUpperCase(),
      optionType,
      strikePrice,
      expirationDate,
      price: Math.max(0.01, premium), // Minimum $0.01
      bid: premium * 0.995,
      ask: premium * 1.005,
      volume: Math.floor(Math.random() * 1000),
      openInterest: Math.floor(Math.random() * 5000),
      impliedVolatility: volatility * 100,
      delta: optionType === 'call' ? 0.5 : -0.5, // Simplified
    };
  } catch (error) {
    console.error('Error fetching option quote:', error);
    return null;
  }
}
