'use client';

import { PortfolioSummary } from '@/lib/actions/portfolio.actions';
import { TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';
import Link from 'next/link';

interface PortfolioSummaryProps {
  portfolio: PortfolioSummary;
}

export default function PortfolioSummary({ portfolio }: PortfolioSummaryProps) {
  const isPositive = portfolio.totalReturn >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Cash Balance</span>
          <Wallet className="h-4 w-4 text-gray-500" />
        </div>
        <p className="text-2xl font-bold text-gray-100">
          ${portfolio.cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Invested</span>
          <DollarSign className="h-4 w-4 text-gray-500" />
        </div>
        <p className="text-2xl font-bold text-gray-100">
          ${portfolio.totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Portfolio Value</span>
          <Wallet className="h-4 w-4 text-gray-500" />
        </div>
        <p className="text-2xl font-bold text-gray-100">
          ${(portfolio.cashBalance + portfolio.currentValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      <div className={`bg-gray-800 border rounded-lg p-4 ${isPositive ? 'border-green-600' : 'border-red-600'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Total Return</span>
          {isPositive ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
        </div>
        <p className={`text-2xl font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {isPositive ? '+' : ''}${portfolio.totalReturn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className={`text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{portfolio.totalReturnPercent.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}

