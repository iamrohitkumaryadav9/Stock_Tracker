'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getPricePrediction, PricePrediction } from '@/lib/actions/prediction.actions';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Brain, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIPricePredictionProps {
  symbol: string;
  currentPrice: number;
  className?: string;
}

export default function AIPricePrediction({ symbol, currentPrice, className }: AIPricePredictionProps) {
  const [prediction, setPrediction] = useState<PricePrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<'1d' | '1w' | '1m' | '3m'>('1d');

  const handlePredict = async () => {
    if (!symbol || symbol.trim() === '') {
      toast.error('Stock symbol is required');
      return;
    }

    setLoading(true);
    setPrediction(null); // Clear previous prediction
    
    try {
      const result = await getPricePrediction(symbol, timeframe);
      if (result) {
        setPrediction(result);
        toast.success('Prediction generated successfully');
      } else {
        toast.error('Unable to generate prediction. Please try again.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Prediction error:', error);
      
      // Provide more specific error messages
      if (errorMessage.includes('GEMINI_API_KEY')) {
        toast.error('Gemini API key is not configured. Please check your environment variables.');
      } else if (errorMessage.includes('Unable to fetch stock quote')) {
        toast.error('Unable to fetch stock data. Please check the symbol and try again.');
      } else {
        toast.error(`Error generating prediction: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const isPositive = prediction ? prediction.predictedChange >= 0 : false;
  const confidenceColors = {
    low: 'text-yellow-400',
    medium: 'text-blue-400',
    high: 'text-green-400'
  };

  return (
    <div className={cn('bg-gray-800 border border-gray-600 rounded-lg p-6', className)}>
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-5 w-5 text-yellow-500" />
        <h3 className="text-xl font-bold text-gray-100">AI Price Prediction</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Prediction Timeframe</label>
          <div className="flex gap-2">
            {(['1d', '1w', '1m', '3m'] as const).map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setTimeframe(tf);
                  setPrediction(null);
                }}
                className={timeframe === tf ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900' : ''}
              >
                {tf === '1d' ? '1 Day' : tf === '1w' ? '1 Week' : tf === '1m' ? '1 Month' : '3 Months'}
              </Button>
            ))}
          </div>
        </div>

        <Button
          onClick={handlePredict}
          disabled={loading}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Brain className="h-4 w-4 mr-2" />
              Generate Prediction
            </>
          )}
        </Button>

        {prediction && (
          <div className="mt-4 space-y-3">
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Current Price</span>
                <span className="text-gray-100 font-semibold">${prediction.currentPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Predicted Price</span>
                <span className={cn('font-bold text-lg', isPositive ? 'text-green-400' : 'text-red-400')}>
                  ${prediction.predictedPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Expected Change</span>
                <div className={cn('flex items-center gap-1', isPositive ? 'text-green-400' : 'text-red-400')}>
                  {isPositive ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span className="font-semibold">
                    {isPositive ? '+' : ''}${prediction.predictedChange.toFixed(2)} ({isPositive ? '+' : ''}{prediction.predictedChangePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Confidence</span>
                <span className={cn('font-semibold capitalize', confidenceColors[prediction.confidence])}>
                  {prediction.confidence}
                </span>
              </div>
              <div className="mt-2">
                <span className="text-gray-400 text-sm block mb-1">Reasoning:</span>
                <p className="text-gray-300 text-sm">{prediction.reasoning}</p>
              </div>
            </div>

            <div className="text-xs text-gray-500 text-center">
              ⚠️ This is an AI-generated prediction for educational purposes only. Not financial advice.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

