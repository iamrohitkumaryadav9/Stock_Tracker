'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { generateTradingSignals, TradingSignals } from '@/lib/actions/ai-analysis.actions';
import { toast } from 'sonner';
import { ArrowUp, ArrowDown, Minus, Brain, Loader2, Signal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TradingSignalsProps {
  symbol: string;
  className?: string;
}

export default function TradingSignals({ symbol, className }: TradingSignalsProps) {
  const [signals, setSignals] = useState<TradingSignals | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!symbol || symbol.trim() === '') {
      toast.error('Stock symbol is required');
      return;
    }

    setLoading(true);
    setSignals(null);
    
    try {
      const result = await generateTradingSignals(symbol);
      if (result) {
        setSignals(result);
        toast.success('Trading signals generated');
      } else {
        toast.error('Unable to generate trading signals. Please try again.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Trading signals error:', error);
      toast.error(`Error generating signals: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'strong_buy':
        return 'text-green-400 bg-green-500/20 border-green-500/50';
      case 'buy':
        return 'text-green-300 bg-green-500/10 border-green-500/30';
      case 'hold':
        return 'text-gray-400 bg-gray-500/20 border-gray-500/50';
      case 'sell':
        return 'text-red-300 bg-red-500/10 border-red-500/30';
      case 'strong_sell':
        return 'text-red-400 bg-red-500/20 border-red-500/50';
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500/50';
    }
  };

  const getSignalIcon = (signal: string) => {
    switch (signal) {
      case 'strong_buy':
      case 'buy':
        return <ArrowUp className="h-4 w-4" />;
      case 'sell':
      case 'strong_sell':
        return <ArrowDown className="h-4 w-4" />;
      default:
        return <Minus className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'text-green-400';
      case 'medium':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getTimeframeLabel = (timeframe: string) => {
    switch (timeframe) {
      case 'short_term':
        return 'Short-term (1-5 days)';
      case 'medium_term':
        return 'Medium-term (1-4 weeks)';
      case 'long_term':
        return 'Long-term (1-3 months)';
      default:
        return timeframe;
    }
  };

  return (
    <div className={cn('bg-gray-800 border border-gray-600 rounded-lg p-6', className)}>
      <div className="flex items-center gap-2 mb-4">
        <Signal className="h-5 w-5 text-yellow-500" />
        <h3 className="text-xl font-bold text-gray-100">Trading Signals</h3>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold mb-4"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Brain className="h-4 w-4 mr-2" />
            Generate Signals
          </>
        )}
      </Button>

      {signals && (
        <div className="space-y-4">
          {/* Overall Signal */}
          <div className={cn('p-4 rounded-lg border-2', getSignalColor(signals.overallSignal))}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Overall Signal</span>
              <div className="flex items-center gap-2 font-bold capitalize">
                {getSignalIcon(signals.overallSignal)}
                <span>{signals.overallSignal.replace('_', ' ')}</span>
              </div>
            </div>
          </div>

          {/* Individual Signals */}
          {signals.signals.length > 0 ? (
            <div className="space-y-3">
              <span className="text-gray-400 text-sm block">Signals by Timeframe</span>
              {signals.signals.map((signal, index) => (
                <div key={index} className="bg-gray-700 p-4 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('px-2 py-1 rounded text-xs font-semibold border capitalize', getSignalColor(signal.signal))}>
                          {getSignalIcon(signal.signal)}
                          <span className="ml-1">{signal.signal.replace('_', ' ')}</span>
                        </span>
                        <span className={cn('text-xs px-2 py-0.5 rounded capitalize', getConfidenceColor(signal.confidence))}>
                          {signal.confidence} confidence
                        </span>
                      </div>
                      <span className="text-gray-500 text-xs">{getTimeframeLabel(signal.timeframe)}</span>
                    </div>
                  </div>
                  
                  <p className="text-gray-300 text-sm mb-2">{signal.reasoning}</p>
                  
                  {(signal.entryPrice || signal.targetPrice || signal.stopLoss) && (
                    <div className="flex gap-4 mt-2 text-xs pt-2 border-t border-gray-600">
                      {signal.entryPrice && (
                        <div>
                          <span className="text-gray-500">Entry: </span>
                          <span className="text-gray-100 font-semibold">${signal.entryPrice.toFixed(2)}</span>
                        </div>
                      )}
                      {signal.targetPrice && (
                        <div>
                          <span className="text-gray-500">Target: </span>
                          <span className="text-green-400 font-semibold">${signal.targetPrice.toFixed(2)}</span>
                        </div>
                      )}
                      {signal.stopLoss && (
                        <div>
                          <span className="text-gray-500">Stop Loss: </span>
                          <span className="text-red-400 font-semibold">${signal.stopLoss.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-700 p-4 rounded-lg text-center">
              <p className="text-gray-400 text-sm">No trading signals generated</p>
            </div>
          )}

          {/* Summary */}
          <div className="bg-gray-700 p-4 rounded-lg">
            <span className="text-gray-400 text-sm block mb-1">Summary</span>
            <p className="text-gray-300 text-sm">{signals.summary}</p>
          </div>

          <div className="text-xs text-gray-500 text-center">
            ⚠️ Trading signals are for informational purposes only. Not financial advice.
          </div>
        </div>
      )}
    </div>
  );
}

