'use client';

import { useState } from 'react';
import TradingPanel from '@/components/PaperTrading/TradingPanel';
import OptionsTradingPanel from './OptionsTradingPanel';
import CryptoTradingPanel from './CryptoTradingPanel';
import ForexTradingPanel from './ForexTradingPanel';
import FuturesTradingPanel from './FuturesTradingPanel';
import CopyTradingPanel from './CopyTradingPanel';
import { cn } from '@/lib/utils';

interface AdvancedTradingTabsProps {
  userId: string;
  onTradeComplete?: () => void;
}

export default function AdvancedTradingTabs({ userId, onTradeComplete }: AdvancedTradingTabsProps) {
  const [activeTab, setActiveTab] = useState<'stocks' | 'options' | 'crypto' | 'forex' | 'futures' | 'copy'>('stocks');

  const tabs = [
    { id: 'stocks' as const, label: 'Stocks', icon: '📈' },
    { id: 'options' as const, label: 'Options', icon: '📊' },
    { id: 'crypto' as const, label: 'Crypto', icon: '₿' },
    { id: 'forex' as const, label: 'Forex', icon: '💱' },
    { id: 'futures' as const, label: 'Futures', icon: '📉' },
    { id: 'copy' as const, label: 'Copy Trading', icon: '👥' },
  ];

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-600 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-yellow-500 text-gray-900 border-b-2 border-yellow-500'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            )}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'stocks' && (
          <TradingPanel symbol="" userId={userId} onTradeComplete={onTradeComplete} />
        )}
        {activeTab === 'options' && (
          <OptionsTradingPanel userId={userId} onTradeComplete={onTradeComplete} />
        )}
        {activeTab === 'crypto' && (
          <CryptoTradingPanel userId={userId} onTradeComplete={onTradeComplete} />
        )}
        {activeTab === 'forex' && (
          <ForexTradingPanel userId={userId} onTradeComplete={onTradeComplete} />
        )}
        {activeTab === 'futures' && (
          <FuturesTradingPanel userId={userId} onTradeComplete={onTradeComplete} />
        )}
        {activeTab === 'copy' && (
          <CopyTradingPanel userId={userId} />
        )}
      </div>
    </div>
  );
}

