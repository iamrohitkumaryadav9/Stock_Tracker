'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

export interface StockQuote {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    timestamp: number;
    previousPrice?: number;
    marketCap?: number;
}

interface WebSocketContextType {
    isConnected: boolean;
    quotes: Map<string, StockQuote>;
    error: string | null;
    subscribe: (symbols: string[]) => void;
    unsubscribe: (symbols: string[]) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function useWebSocketContext() {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocketContext must be used within a WebSocketProvider');
    }
    return context;
}

interface WebSocketProviderProps {
    children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Track subscription counts for each symbol to handle multiple components subscribing to the same symbol
    const subscriptionCountsRef = useRef<Map<string, number>>(new Map());
    // Track actually subscribed symbols on the WebSocket
    const activeSubscriptionsRef = useRef<Set<string>>(new Set());

    const finnhubApiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';

    // Store previous prices to calculate change
    const priceHistoryRef = useRef<Map<string, number>>(new Map());

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        if (!finnhubApiKey) {
            console.warn('Finnhub API key not configured, WebSocket disabled');
            return;
        }

        try {
            const wsUrl = `wss://ws.finnhub.io?token=${finnhubApiKey}`;
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                setIsConnected(true);
                setError(null);
                console.log('Global WebSocket connected to Finnhub');

                // Resubscribe to all active symbols
                const symbolsToSubscribe = Array.from(subscriptionCountsRef.current.keys());
                if (symbolsToSubscribe.length > 0) {
                    symbolsToSubscribe.forEach(symbol => {
                        if (!activeSubscriptionsRef.current.has(symbol)) {
                            ws.send(JSON.stringify({ type: 'subscribe', symbol }));
                            activeSubscriptionsRef.current.add(symbol);
                        }
                    });
                }
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'ping') {
                        ws.send(JSON.stringify({ type: 'pong' }));
                        return;
                    }

                    if (data.type === 'trade' && Array.isArray(data.data)) {
                        data.data.forEach((trade: any) => {
                            const symbol = trade.s?.toUpperCase();
                            const price = trade.p;
                            const timestamp = trade.t || Date.now();

                            if (!symbol || !price) return;

                            const previousPrice = priceHistoryRef.current.get(symbol);
                            const change = previousPrice ? price - previousPrice : 0;
                            const changePercent = previousPrice ? (change / previousPrice) * 100 : 0;

                            priceHistoryRef.current.set(symbol, price);

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
                                // Preserve existing data like marketCap if available
                                const existing = newMap.get(symbol);
                                newMap.set(symbol, { ...existing, ...quote });
                                return newMap;
                            });
                        });
                    }
                } catch (err) {
                    console.error('Error parsing WebSocket message:', err);
                }
            };

            ws.onclose = (event) => {
                setIsConnected(false);
                activeSubscriptionsRef.current.clear();

                // Don't reconnect on auth errors
                if (event.code >= 4000 && event.code < 5000) {
                    setError(`WebSocket auth error: ${event.code}`);
                    return;
                }

                // Auto-reconnect
                reconnectTimeoutRef.current = setTimeout(() => {
                    connect();
                }, 5000);
            };

            ws.onerror = (event) => {
                console.error('WebSocket error occurred:', event);
                // Check if it's an authentication error or connection limit
                if (ws.readyState === WebSocket.CLOSED) {
                    console.error('WebSocket closed immediately. Check API key or connection limits.');
                }
                ws.close();
            };

            wsRef.current = ws;
        } catch (err) {
            console.error('Failed to connect to WebSocket:', err);
            setError('Failed to connect');
        }
    }, [finnhubApiKey]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
        activeSubscriptionsRef.current.clear();
    }, []);

    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    const subscribe = useCallback((symbols: string[]) => {
        symbols.forEach(symbol => {
            const upperSymbol = symbol.toUpperCase();
            const currentCount = subscriptionCountsRef.current.get(upperSymbol) || 0;
            subscriptionCountsRef.current.set(upperSymbol, currentCount + 1);

            if (currentCount === 0 && wsRef.current?.readyState === WebSocket.OPEN) {
                if (!activeSubscriptionsRef.current.has(upperSymbol)) {
                    wsRef.current.send(JSON.stringify({ type: 'subscribe', symbol: upperSymbol }));
                    activeSubscriptionsRef.current.add(upperSymbol);
                }
            }
        });
    }, []);

    const unsubscribe = useCallback((symbols: string[]) => {
        symbols.forEach(symbol => {
            const upperSymbol = symbol.toUpperCase();
            const currentCount = subscriptionCountsRef.current.get(upperSymbol) || 0;

            if (currentCount > 0) {
                const newCount = currentCount - 1;
                if (newCount === 0) {
                    subscriptionCountsRef.current.delete(upperSymbol);
                    if (wsRef.current?.readyState === WebSocket.OPEN && activeSubscriptionsRef.current.has(upperSymbol)) {
                        wsRef.current.send(JSON.stringify({ type: 'unsubscribe', symbol: upperSymbol }));
                        activeSubscriptionsRef.current.delete(upperSymbol);
                    }
                } else {
                    subscriptionCountsRef.current.set(upperSymbol, newCount);
                }
            }
        });
    }, []);

    return (
        <WebSocketContext.Provider value={{ isConnected, quotes, error, subscribe, unsubscribe }}>
            {children}
        </WebSocketContext.Provider>
    );
}
