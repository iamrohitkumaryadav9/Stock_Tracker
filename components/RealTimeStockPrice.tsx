'use client';

import { useWebSocket, StockQuote } from '@/hooks/useWebSocket';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface RealTimeStockPriceProps {
  symbol: string;
  initialPrice?: number;
  initialChange?: number;
  initialChangePercent?: number;
  className?: string;
  showIndicator?: boolean;
}

export default function RealTimeStockPrice({
  symbol,
  initialPrice,
  initialChange,
  initialChangePercent,
  className,
  showIndicator = true
}: RealTimeStockPriceProps) {
  const [currentQuote, setCurrentQuote] = useState<StockQuote | null>(null);
  const [priceChange, setPriceChange] = useState<'up' | 'down' | 'neutral'>('neutral');

  const { quotes, isConnected } = useWebSocket({
    symbols: [symbol],
    onMessage: (quote) => {
      setCurrentQuote(quote);
      // Determine price change direction
      if (quote.previousPrice) {
        if (quote.price > quote.previousPrice) {
          setPriceChange('up');
        } else if (quote.price < quote.previousPrice) {
          setPriceChange('down');
        } else {
          setPriceChange('neutral');
        }
      }
    }
  });

  // Update from quotes map
  useEffect(() => {
    const quote = quotes.get(symbol.toUpperCase());
    if (quote) {
      setCurrentQuote(quote);
    }
  }, [quotes, symbol]);

  const displayPrice = currentQuote?.price ?? initialPrice ?? 0;
  const displayChange = currentQuote?.change ?? initialChange ?? 0;
  const displayChangePercent = currentQuote?.changePercent ?? initialChangePercent ?? 0;

  const isPositive = displayChange >= 0;
  const priceColor = isPositive ? 'text-green-500' : 'text-red-500';
  const changeColor = isPositive ? 'text-green-400' : 'text-red-400';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className={cn('font-semibold', priceColor)}>
        ${displayPrice.toFixed(2)}
      </span>
      {displayChange !== 0 && (
        <span className={cn('text-sm', changeColor)}>
          {isPositive ? '+' : ''}{displayChange.toFixed(2)} ({isPositive ? '+' : ''}{displayChangePercent.toFixed(2)}%)
        </span>
      )}
      {showIndicator && isConnected && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      )}
      {showIndicator && !isConnected && (
        <span className="h-2 w-2 rounded-full bg-gray-500" title="Not connected"></span>
      )}
    </div>
  );
}

