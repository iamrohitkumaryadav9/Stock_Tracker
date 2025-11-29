'use client';

import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

interface Transaction {
  assetType?: 'stock' | 'crypto' | 'forex' | 'futures' | 'options';
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  totalAmount: number;
  timestamp: Date;
  isCopied?: boolean;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
}

export default function TransactionHistory({ transactions }: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-8 text-center">
        <p className="text-gray-400">No transactions yet. Start trading to see your history!</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="table-header-row">
              <th className="table-header text-left pl-4 py-3">Asset</th>
              <th className="table-header text-left py-3">Type</th>
              <th className="table-header text-left py-3">Symbol</th>
              <th className="table-header text-right py-3">Quantity</th>
              <th className="table-header text-right py-3">Price</th>
              <th className="table-header text-right py-3">Total</th>
              <th className="table-header text-right py-3 pr-4">Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction, index) => {
              const isBuy = transaction.type === 'buy';
              const date = new Date(transaction.timestamp);
              const assetType = transaction.assetType || 'stock';

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

              return (
                <tr key={index} className="table-row">
                  <td className="table-cell pl-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${assetTypeColors[assetType]}`}>
                      {assetTypeLabels[assetType]}
                    </span>
                    {transaction.isCopied && (
                      <span className="ml-2 text-xs px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded">
                        Copied
                      </span>
                    )}
                  </td>
                  <td className="table-cell py-3">
                    <div className={`flex items-center gap-2 ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                      {isBuy ? (
                        <ArrowUpCircle className="h-4 w-4" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4" />
                      )}
                      <span className="font-semibold uppercase">{transaction.type}</span>
                    </div>
                  </td>
                  <td className="table-cell py-3">
                    <span className="font-mono font-semibold">{transaction.symbol}</span>
                  </td>
                  <td className="table-cell text-right py-3 text-gray-300">
                    {transaction.quantity}
                  </td>
                  <td className="table-cell text-right py-3 text-gray-300">
                    ${transaction.price.toFixed(2)}
                  </td>
                  <td className="table-cell text-right py-3 text-gray-100 font-semibold">
                    ${transaction.totalAmount.toFixed(2)}
                  </td>
                  <td className="table-cell text-right py-3 pr-4 text-gray-400 text-sm">
                    {date.toLocaleDateString()} {date.toLocaleTimeString()}
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

