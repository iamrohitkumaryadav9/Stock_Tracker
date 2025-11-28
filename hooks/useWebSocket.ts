'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
  previousPrice?: number;
}

interface UseWebSocketOptions {
  symbols: string[];
  onMessage?: (data: StockQuote) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

// Store previous prices to calculate change
const priceHistory = new Map<string, number>();

export function useWebSocket({ 
  symbols, 
  onMessage, 
  autoReconnect = true,
  reconnectInterval = 5000 
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscribedSymbolsRef = useRef<Set<string>>(new Set());
  const finnhubApiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (!finnhubApiKey || finnhubApiKey.trim() === '') {
      console.warn('Finnhub API key not configured, WebSocket disabled');
      setError('API key not configured. Please set NEXT_PUBLIC_FINNHUB_API_KEY in your environment variables.');
      return;
    }

    // Validate API key format (Finnhub API keys are typically alphanumeric)
    if (finnhubApiKey.length < 20) {
      console.warn('Finnhub API key appears to be invalid (too short)');
      setError('Invalid API key format. Please check your NEXT_PUBLIC_FINNHUB_API_KEY.');
      return;
    }

    try {
      // Connect directly to Finnhub WebSocket
      const wsUrl = `wss://ws.finnhub.io?token=${finnhubApiKey}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        console.log('WebSocket connected to Finnhub');
        
        // Wait a moment before subscribing to ensure connection is stable
        setTimeout(() => {
          // Subscribe to symbols
          if (symbols.length > 0 && ws.readyState === WebSocket.OPEN) {
            symbols.forEach(symbol => {
              const upperSymbol = symbol.toUpperCase();
              if (!subscribedSymbolsRef.current.has(upperSymbol)) {
                const subscribeMessage = {
                  type: 'subscribe',
                  symbol: upperSymbol
                };
                console.log('Subscribing to symbol:', upperSymbol);
                ws.send(JSON.stringify(subscribeMessage));
                subscribedSymbolsRef.current.add(upperSymbol);
              }
            });
          }
        }, 100);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Log all messages for debugging (can be removed in production)
          console.log('WebSocket message received:', data);
          
          // Check for error messages from Finnhub
          if (data.type === 'error') {
            console.error('Finnhub WebSocket error:', data.msg || data.message || 'Unknown error');
            setError(data.msg || data.message || 'WebSocket error from server');
            return;
          }
          
          // Check for ping/pong messages
          if (data.type === 'ping') {
            // Respond to ping with pong
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }
          
          // Finnhub sends trade data in format: { type: 'trade', data: [...] }
          if (data.type === 'trade' && Array.isArray(data.data)) {
            data.data.forEach((trade: any) => {
              const symbol = trade.s?.toUpperCase();
              const price = trade.p;
              const timestamp = trade.t || Date.now();

              if (!symbol || !price) return;

              const previousPrice = priceHistory.get(symbol);
              const change = previousPrice ? price - previousPrice : 0;
              const changePercent = previousPrice ? (change / previousPrice) * 100 : 0;

              // Update price history
              priceHistory.set(symbol, price);

              const quote: StockQuote = {
                symbol,
                price,
                change,
                changePercent,
                timestamp,
                previousPrice
              };

              setQuotes(prev => {
                const newMap = new Map(prev);
                newMap.set(symbol, quote);
                return newMap;
              });

              onMessage?.(quote);
            });
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err, 'Raw data:', event.data);
        }
      };

      ws.onerror = (event) => {
        // WebSocket error events don't have standard error properties
        // Check the readyState to determine the issue
        const readyStateNames = {
          [WebSocket.CONNECTING]: 'CONNECTING',
          [WebSocket.OPEN]: 'OPEN',
          [WebSocket.CLOSING]: 'CLOSING',
          [WebSocket.CLOSED]: 'CLOSED'
        };
        
        const readyStateName = readyStateNames[ws.readyState] || 'UNKNOWN';
        const errorMessage = ws.readyState === WebSocket.CLOSED 
          ? 'WebSocket connection closed unexpectedly'
          : ws.readyState === WebSocket.CONNECTING
          ? 'WebSocket connection failed'
          : 'WebSocket error occurred';
        
        // Log as formatted string to avoid empty object serialization issues
        console.error(
          `WebSocket error: ${errorMessage}\n` +
          `  ReadyState: ${readyStateName} (${ws.readyState})\n` +
          `  URL: ${wsUrl.replace(/token=[^&]+/, 'token=[REDACTED]')}\n` +
          `  API Key configured: ${!!finnhubApiKey}`
        );
        
        setError(errorMessage);
        setIsConnected(false);
        
        // Prevent the error from bubbling up
        if (event && typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        
        // Log close information for debugging
        const closeInfo = {
          code: event.code,
          reason: event.reason || 'No reason provided',
          wasClean: event.wasClean
        };
        
        // Common WebSocket close codes:
        // 1000: Normal closure
        // 1001: Going away
        // 1002: Protocol error
        // 1003: Unsupported data
        // 1006: Abnormal closure (no close frame)
        // 1007: Invalid data
        // 1008: Policy violation
        // 1009: Message too big
        // 1011: Internal error
        // 4001-4004: Custom codes (often used by services for auth errors)
        
        let errorMessage = `WebSocket disconnected (code: ${event.code})`;
        
        // Provide specific error messages based on close code
        if (event.code === 1006) {
          errorMessage = 'WebSocket connection closed abnormally. This may indicate network issues or an invalid API key.';
        } else if (event.code === 1008) {
          errorMessage = 'WebSocket connection closed due to policy violation. Please check your API key permissions.';
        } else if (event.code >= 4000 && event.code < 5000) {
          errorMessage = `WebSocket connection closed by server (code: ${event.code}). This may indicate an authentication or authorization issue. Please verify your Finnhub API key is valid and has WebSocket access.`;
        } else if (event.reason) {
          errorMessage = `WebSocket disconnected: ${event.reason} (code: ${event.code})`;
        }
        
        if (!event.wasClean) {
          console.warn('WebSocket disconnected unexpectedly:', {
            ...closeInfo,
            errorMessage,
            url: wsUrl.replace(/token=[^&]+/, 'token=[REDACTED]')
          });
          setError(errorMessage);
        } else {
          console.log('WebSocket disconnected cleanly:', closeInfo);
        }

        // Auto-reconnect if enabled and connection wasn't cleanly closed
        // Don't reconnect if it's an authentication error (codes 4000+)
        const isAuthError = event.code >= 4000 && event.code < 5000;
        if (autoReconnect && symbols.length > 0 && !event.wasClean && !isAuthError) {
          console.log(`Attempting to reconnect in ${reconnectInterval}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (isAuthError) {
          console.error('Authentication error detected. Not attempting to reconnect. Please check your API key.');
        }
      };

      wsRef.current = ws;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorStack = err instanceof Error ? err.stack : undefined;
      
      // Log as formatted string to avoid empty object serialization issues
      console.error(
        `Failed to create WebSocket: ${errorMessage}\n` +
        `  URL: wss://ws.finnhub.io?token=${finnhubApiKey ? '[REDACTED]' : 'MISSING'}\n` +
        (errorStack ? `  Stack: ${errorStack}\n` : '')
      );
      
      setError(`Failed to connect to WebSocket: ${errorMessage}`);
      setIsConnected(false);
    }
  }, [symbols, onMessage, autoReconnect, reconnectInterval, finnhubApiKey]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      // Unsubscribe from all symbols
      subscribedSymbolsRef.current.forEach(symbol => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'unsubscribe',
            symbol
          }));
        }
      });
      subscribedSymbolsRef.current.clear();
      
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  const subscribe = useCallback((newSymbols: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      newSymbols.forEach(symbol => {
        const upperSymbol = symbol.toUpperCase();
        if (!subscribedSymbolsRef.current.has(upperSymbol)) {
          wsRef.current?.send(JSON.stringify({
            type: 'subscribe',
            symbol: upperSymbol
          }));
          subscribedSymbolsRef.current.add(upperSymbol);
        }
      });
    }
  }, []);

  const unsubscribe = useCallback((symbolsToRemove: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      symbolsToRemove.forEach(symbol => {
        const upperSymbol = symbol.toUpperCase();
        if (subscribedSymbolsRef.current.has(upperSymbol)) {
          wsRef.current?.send(JSON.stringify({
            type: 'unsubscribe',
            symbol: upperSymbol
          }));
          subscribedSymbolsRef.current.delete(upperSymbol);
        }
      });
    }
  }, []);

  // Update subscriptions when symbols change
  useEffect(() => {
    if (isConnected && wsRef.current) {
      const currentSymbols = new Set(symbols.map(s => s.toUpperCase()));
      const added = symbols.filter(s => !subscribedSymbolsRef.current.has(s.toUpperCase()));
      const removed = Array.from(subscribedSymbolsRef.current).filter(s => !currentSymbols.has(s));

      if (added.length > 0) {
        subscribe(added);
      }
      if (removed.length > 0) {
        unsubscribe(removed);
      }
    }
  }, [symbols, isConnected, subscribe, unsubscribe]);

  // Connect on mount
  useEffect(() => {
    if (symbols.length > 0 && finnhubApiKey) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [finnhubApiKey]); // Only reconnect if API key changes

  // Handle symbol changes when connected
  useEffect(() => {
    if (isConnected && wsRef.current && symbols.length > 0) {
      const currentSymbols = new Set(symbols.map(s => s.toUpperCase()));
      const added = symbols.filter(s => !subscribedSymbolsRef.current.has(s.toUpperCase()));
      const removed = Array.from(subscribedSymbolsRef.current).filter(s => !currentSymbols.has(s));

      if (added.length > 0) {
        subscribe(added);
      }
      if (removed.length > 0) {
        unsubscribe(removed);
      }
    }
  }, [symbols.join(','), isConnected, subscribe, unsubscribe]); // Re-run when symbols change

  return {
    isConnected,
    quotes,
    error,
    connect,
    disconnect,
    subscribe,
    unsubscribe
  };
}

