'use client';

import { PortfolioSummary } from '@/lib/actions/portfolio.actions';
import RealTimeStockPrice from '../RealTimeStockPrice';
import Link from 'next/link';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PositionsTableProps {
  positions: PortfolioSummary['positions'];
}

export default function PositionsTable({ positions }: PositionsTableProps) {
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
              <th className="table-header text-left pl-4 py-3">Symbol</th>
              <th className="table-header text-left py-3">Quantity</th>
              <th className="table-header text-right py-3">Avg Price</th>
              <th className="table-header text-right py-3">Current Price</th>
              <th className="table-header text-right py-3">Total Cost</th>
              <th className="table-header text-right py-3">Current Value</th>
              <th className="table-header text-right py-3">Gain/Loss</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => {
              const isPositive = position.gainLoss >= 0;
              return (
                <tr key={position.symbol} className="table-row">
                  <td className="table-cell pl-4 py-3">
                    <Link
                      href={`/stocks/${position.symbol}`}
                      className="font-mono font-semibold hover:text-yellow-500 transition-colors"
                    >
                      {position.symbol}
                    </Link>
                  </td>
                  <td className="table-cell py-3 text-gray-300">{position.quantity}</td>
                  <td className="table-cell text-right py-3 text-gray-300">
                    ${position.averagePrice.toFixed(2)}
                  </td>
                  <td className="table-cell text-right py-3">
                    <RealTimeStockPrice
                      symbol={position.symbol}
                      initialPrice={position.currentPrice}
                      showIndicator={true}
                    />
                  </td>
                  <td className="table-cell text-right py-3 text-gray-300">
                    ${position.totalCost.toFixed(2)}
                  </td>
                  <td className="table-cell text-right py-3 text-gray-300">
                    ${position.currentValue.toFixed(2)}
                  </td>
                  <td className={`table-cell text-right py-3 font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
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

