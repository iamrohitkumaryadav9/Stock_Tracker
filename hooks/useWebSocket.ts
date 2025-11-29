'use client';

import { useEffect, useRef } from 'react';
import { useWebSocketContext, StockQuote } from '@/components/providers/WebSocketProvider';

export type { StockQuote };

interface UseWebSocketOptions {
  symbols: string[];
  onMessage?: (data: StockQuote) => void;
  enabled?: boolean;
}

export function useWebSocket({
  symbols,
  onMessage,
  enabled = true
}: UseWebSocketOptions) {
  const { isConnected, quotes, error, subscribe, unsubscribe } = useWebSocketContext();
  const subscribedSymbolsRef = useRef<Set<string>>(new Set());

  // Handle subscriptions
  useEffect(() => {
    if (!enabled || symbols.length === 0) return;

    const currentSymbols = symbols.map(s => s.toUpperCase());

    // Subscribe to new symbols
    subscribe(currentSymbols);

    // Track what we've subscribed to for cleanup
    currentSymbols.forEach(s => subscribedSymbolsRef.current.add(s));

    return () => {
      // Unsubscribe on unmount or change
      unsubscribe(currentSymbols);
      currentSymbols.forEach(s => subscribedSymbolsRef.current.delete(s));
    };
  }, [symbols.join(','), enabled, subscribe, unsubscribe]);

  // Handle messages via effect (optional, mostly for specific callbacks)
  useEffect(() => {
    if (onMessage) {
      symbols.forEach(symbol => {
        const quote = quotes.get(symbol.toUpperCase());
        if (quote) {
          onMessage(quote);
        }
      });
    }
  }, [quotes, symbols, onMessage]);

  return {
    isConnected,
    quotes,
    error
  };
}
