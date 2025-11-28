'use server';

import { cache } from 'react';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const FINNHUB_API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY || process.env.FINNHUB_API_KEY || '';

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose?: number;
  high?: number;
  low?: number;
  open?: number;
  volume?: number;
  marketCap?: number;
  peRatio?: number;
}

export const getStockQuote = cache(async (symbol: string): Promise<StockQuote | null> => {
  try {
    if (!FINNHUB_API_KEY) {
      console.error('Finnhub API key not configured');
      return null;
    }

    const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol.toUpperCase())}&token=${FINNHUB_API_KEY}`;
    
    const response = await fetch(url, {
      next: { revalidate: 60 } // Cache for 60 seconds
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch quote: ${response.status}`);
    }

    const data = await response.json();

    if (data.c === 0 && data.d === null && data.dp === null) {
      // No data available
      return null;
    }

    const currentPrice = data.c || 0;
    const previousClose = data.pc || currentPrice;
    const change = currentPrice - previousClose;
    const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;

    return {
      symbol: symbol.toUpperCase(),
      price: currentPrice,
      change,
      changePercent,
      previousClose,
      high: data.h,
      low: data.l,
      open: data.o,
      volume: data.v
    };
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
    return null;
  }
});

export const getStockQuotes = cache(async (symbols: string[]): Promise<Map<string, StockQuote>> => {
  const quotes = new Map<string, StockQuote>();
  
  // Fetch quotes in parallel (limit to 10 at a time to avoid rate limits)
  const batches = [];
  for (let i = 0; i < symbols.length; i += 10) {
    batches.push(symbols.slice(i, i + 10));
  }

  for (const batch of batches) {
    const results = await Promise.all(
      batch.map(symbol => getStockQuote(symbol))
    );

    results.forEach((quote, index) => {
      if (quote) {
        quotes.set(batch[index].toUpperCase(), quote);
      }
    });

    // Small delay between batches to respect rate limits
    if (batches.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return quotes;
});

