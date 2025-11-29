'use client';

import { PortfolioSummary } from '@/lib/actions/portfolio.actions';
import RealTimeStockPrice from '../RealTimeStockPrice';
import Link from 'next/link';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWebSocket, StockQuote } from '@/hooks/useWebSocket';
import { useState, useEffect } from 'react';

interface PositionsTableProps {
  positions: PortfolioSummary['positions'];
}

export default function PositionsTable({ positions }: PositionsTableProps) {
  const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());

  // Get unique symbols from positions
  const symbols = Array.from(new Set(positions.map(p => p.symbol)));

  // WebSocket for real-time updates
  const { quotes: wsQuotes } = useWebSocket({
    symbols,
    onMessage: (quote) => {
      setQuotes(prev => {
        const newMap = new Map(prev);
        newMap.set(quote.symbol, quote);
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

  if (positions.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-8 text-center">
        <p className="text-gray-400">No positions yet. Start trading to build your portfolio!</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="table-header-row">
              <th className="table-header text-left pl-4 py-3">Type</th>
              <th className="table-header text-left py-3">Symbol</th>
              <th className="table-header text-left py-3">Quantity</th>
              <th className="table-header text-right py-3">Avg Price</th>
              <th className="table-header text-right py-3">Current Price</th>
              <th className="table-header text-right py-3">Total Cost</th>
              <th className="table-header text-right py-3">Current Value</th>
              <th className="table-header text-right py-3 pr-4">Gain/Loss</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position, index) => {
              const isPositive = position.gainLoss >= 0;
              const assetTypeLabels = {
                stock: 'Stock',
                crypto: 'Crypto',
                forex: 'Forex',
                futures: 'Futures',
                options: 'Options'
              };

              const assetTypeColors = {
                stock: 'bg-blue-500/20 text-blue-400',
                crypto: 'bg-yellow-500/20 text-yellow-400',
                forex: 'bg-green-500/20 text-green-400',
                futures: 'bg-purple-500/20 text-purple-400',
                options: 'bg-orange-500/20 text-orange-400'
              };

              const positionKey = `${position.assetType}-${position.symbol}-${index}`;
              const displaySymbol = position.optionType && position.strikePrice
                ? `${position.symbol} ${position.optionType.toUpperCase()} $${position.strikePrice}`
                : position.symbol;

              return (
                <tr key={positionKey} className="table-row">
                  <td className="table-cell pl-4 py-3">
                    <span className={cn('px-2 py-1 rounded text-xs font-semibold', assetTypeColors[position.assetType])}>
                      {assetTypeLabels[position.assetType]}
                    </span>
                  </td>
                  <td className="table-cell py-3">
                    {position.assetType === 'stock' ? (
                      <Link
                        href={`/stocks/${position.symbol}`}
                        className="font-mono font-semibold hover:text-yellow-500 transition-colors"
                      >
                        {displaySymbol}
                      </Link>
                    ) : (
                      <span className="font-mono font-semibold">{displaySymbol}</span>
                    )}
                    {position.expirationDate && (
                      <div className="text-xs text-gray-500 mt-1">
                        Exp: {new Date(position.expirationDate).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="table-cell py-3 text-gray-300">
                    {position.quantity}
                    {position.assetType === 'options' && <span className="text-xs text-gray-500 ml-1">contracts</span>}
                    {position.assetType === 'forex' && <span className="text-xs text-gray-500 ml-1">lots</span>}
                    {position.assetType === 'futures' && <span className="text-xs text-gray-500 ml-1">contracts</span>}
                  </td>
                  <td className="table-cell text-right py-3 text-gray-300">
                    ${position.averagePrice.toFixed(2)}
                  </td>
                  <td className="table-cell text-right py-3">
                    {position.assetType === 'stock' ? (
                      <RealTimeStockPrice
                        symbol={position.symbol}
                        initialPrice={position.currentPrice}
                        showIndicator={true}
                        useWebSocket={false}
                        currentPrice={quotes.get(position.symbol.toUpperCase())?.price}
                        currentChange={quotes.get(position.symbol.toUpperCase())?.change}
                        currentChangePercent={quotes.get(position.symbol.toUpperCase())?.changePercent}
                      />
                    ) : (
                      <span className="text-gray-100">
                        ${position.currentPrice.toFixed(position.assetType === 'forex' ? 5 : 2)}
                      </span>
                    )}
                  </td>
                  <td className="table-cell text-right py-3 text-gray-300">
                    ${position.totalCost.toFixed(2)}
                  </td>
                  <td className="table-cell text-right py-3 text-gray-300">
                    ${position.currentValue.toFixed(2)}
                  </td>
                  <td className={`table-cell text-right py-3 pr-4 font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    <div className="flex items-center justify-end gap-1">
                      {isPositive ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      <span>
                        {isPositive ? '+' : ''}${position.gainLoss.toFixed(2)}
                      </span>
                      <span className="text-sm">
                        ({isPositive ? '+' : ''}{position.gainLossPercent.toFixed(2)}%)
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

