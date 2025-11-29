'use client';

import { useEffect, useState } from 'react';
import { useWebSocket, StockQuote } from '@/hooks/useWebSocket';
import { getStockQuotes } from '@/lib/actions/quote.actions';
import RealTimeStockPrice from './RealTimeStockPrice';
import WatchlistButton from './WatchlistButton';
import Link from 'next/link';

interface WatchlistTableProps {
  watchlist: Array<{
    symbol: string;
    company: string;
    userId: string;
    addedAt: Date;
  }>;
}

export default function WatchlistTable({ watchlist }: WatchlistTableProps) {
  const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [loading, setLoading] = useState(true);
  const symbols = watchlist.map(item => item.symbol);

  // Fetch initial quotes
  useEffect(() => {
    const fetchInitialQuotes = async () => {
      if (symbols.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const initialQuotes = await getStockQuotes(symbols);
        // Convert to Map compatible with useWebSocket StockQuote
        const quotesMap = new Map<string, StockQuote>();
        initialQuotes.forEach((quote, symbol) => {
          quotesMap.set(symbol, {
            ...quote,
            timestamp: quote.timestamp || Date.now()
          });
        });
        setQuotes(quotesMap);
      } catch (error) {
        console.error('Error fetching initial quotes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialQuotes();
  }, [symbols.join(',')]);

  // WebSocket for real-time updates
  const { quotes: wsQuotes, isConnected } = useWebSocket({
    symbols,
    onMessage: (quote) => {
      setQuotes(prev => {
        const newMap = new Map(prev);
        // Merge existing quote data (like marketCap) with new real-time data
        const existingQuote = newMap.get(quote.symbol);
        newMap.set(quote.symbol, {
          ...existingQuote,
          ...quote,
          // Preserve marketCap if it exists in existing quote but not in new quote
          marketCap: existingQuote?.marketCap
        });
        return newMap;
      });
    }
  });

  // Update quotes from WebSocket
  useEffect(() => {
    wsQuotes.forEach((quote, symbol) => {
      setQuotes(prev => {
        const newMap = new Map(prev);
        newMap.set(symbol, quote);
        return newMap;
      });
    });
  }, [wsQuotes]);

  if (watchlist.length === 0) {
    return (
      <div className="watchlist-empty-container">
        <div className="watchlist-empty">
          <div className="watchlist-star">⭐</div>
          <h2 className="empty-title">Your watchlist is empty</h2>
          <p className="empty-description">
            Start building your watchlist by searching for stocks and adding them to track their performance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="watchlist-table">
      <table className="w-full">
        <thead>
          <tr className="table-header-row">
            <th className="table-header text-left pl-4 py-3">Company</th>
            <th className="table-header text-left py-3">Symbol</th>
            <th className="table-header text-right py-3">Price</th>
            <th className="table-header text-right py-3">Change</th>
            <th className="table-header text-right py-3">Market Cap</th>
            <th className="table-header text-center py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {watchlist.map((item) => {
            const quote = quotes.get(item.symbol.toUpperCase());
            const price = quote?.price;
            const change = quote?.change;
            const changePercent = quote?.changePercent;

            return (
              <tr key={`${item.userId}-${item.symbol}`} className="table-row">
                <td className="table-cell pl-4 py-3">
                  <Link
                    href={`/stocks/${item.symbol}`}
                    className="hover:text-yellow-500 transition-colors"
                  >
                    {item.company}
                  </Link>
                </td>
                <td className="table-cell py-3">
                  <Link
                    href={`/stocks/${item.symbol}`}
                    className="hover:text-yellow-500 transition-colors font-mono"
                  >
                    {item.symbol}
                  </Link>
                </td>
                <td className="table-cell text-right py-3">
                  {loading ? (
                    <span className="text-gray-500">Loading...</span>
                  ) : (
                    <RealTimeStockPrice
                      symbol={item.symbol}
                      initialPrice={price}
                      initialChange={change}
                      initialChangePercent={changePercent}
                      showIndicator={true}
                      useWebSocket={false}
                      currentPrice={price}
                      currentChange={change}
                      currentChangePercent={changePercent}
                    />
                  )}
                </td>
                <td className="table-cell text-right py-3">
                  {quote && (
                    <span className={change && change >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {change && change >= 0 ? '+' : ''}{changePercent?.toFixed(2)}%
                    </span>
                  )}
                </td>
                <td className="table-cell text-right py-3 text-gray-400">
                  {quote?.marketCap ? `$${(quote.marketCap / 1e9).toFixed(2)}B` : '-'}
                </td>
                <td className="table-cell text-center py-3">
                  <WatchlistButton
                    symbol={item.symbol}
                    company={item.company}
                    isInWatchlist={true}
                    type="icon"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

