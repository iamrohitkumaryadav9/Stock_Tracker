'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { recognizePatterns } from '@/lib/actions/ai-analysis.actions';
import type { PatternRecognition } from '@/lib/actions/ai-analysis.actions';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Minus, Brain, Loader2, BarChart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PatternRecognitionProps {
  symbol: string;
  className?: string;
}

export default function PatternRecognition({ symbol, className }: PatternRecognitionProps) {
  const [analysis, setAnalysis] = useState<PatternRecognition | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!symbol || symbol.trim() === '') {
      toast.error('Stock symbol is required');
      return;
    }

    setLoading(true);
    setAnalysis(null);

    try {
      const result = await recognizePatterns(symbol);
      if (result) {
        setAnalysis(result);
        toast.success('Pattern recognition completed');
      } else {
        toast.error('Unable to recognize patterns. Please try again.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Pattern recognition error:', error);
      toast.error(`Error recognizing patterns: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const getOutlookColor = (outlook: string) => {
    switch (outlook) {
      case 'bullish':
        return 'text-green-400';
      case 'bearish':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getOutlookIcon = (outlook: string) => {
    switch (outlook) {
      case 'bullish':
        return <TrendingUp className="h-5 w-5" />;
      case 'bearish':
        return <TrendingDown className="h-5 w-5" />;
      default:
        return <Minus className="h-5 w-5" />;
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

  return (
    <div className={cn('bg-gray-800 border border-gray-600 rounded-lg p-6', className)}>
      <div className="flex items-center gap-2 mb-4">
        <BarChart className="h-5 w-5 text-yellow-500" />
        <h3 className="text-xl font-bold text-gray-100">Pattern Recognition</h3>
      </div>

      <Button
        onClick={handleAnalyze}
        disabled={loading}
        className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold mb-4"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Brain className="h-4 w-4 mr-2" />
            Recognize Patterns
          </>
        )}
      </Button>

      {analysis && (
        <div className="space-y-4">
          {/* Overall Outlook */}
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Overall Outlook</span>
              <div className={cn('flex items-center gap-2 font-bold capitalize', getOutlookColor(analysis.overallOutlook))}>
                {getOutlookIcon(analysis.overallOutlook)}
                <span>{analysis.overallOutlook}</span>
              </div>
            </div>
            <p className="text-gray-300 text-sm mt-2">{analysis.summary}</p>
          </div>

          {/* Detected Patterns */}
          {analysis.patterns.length > 0 ? (
            <div className="space-y-3">
              <span className="text-gray-400 text-sm block">Detected Patterns</span>
              {analysis.patterns.map((pattern, index) => (
                <div key={index} className="bg-gray-700 p-4 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-100 font-semibold">{pattern.patternName}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded capitalize', getConfidenceColor(pattern.confidence))}>
                          {pattern.confidence} confidence
                        </span>
                      </div>
                      <span className="text-gray-500 text-xs">{pattern.patternType}</span>
                    </div>
                    {pattern.bullish ? (
                      <TrendingUp className="h-4 w-4 text-green-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                  <p className="text-gray-300 text-sm mb-2">{pattern.description}</p>
                  {(pattern.targetPrice || pattern.stopLoss) && (
                    <div className="flex gap-4 mt-2 text-xs">
                      {pattern.targetPrice && (
                        <div>
                          <span className="text-gray-500">Target: </span>
                          <span className="text-green-400 font-semibold">${pattern.targetPrice.toFixed(2)}</span>
                        </div>
                      )}
                      {pattern.stopLoss && (
                        <div>
                          <span className="text-gray-500">Stop Loss: </span>
                          <span className="text-red-400 font-semibold">${pattern.stopLoss.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-700 p-4 rounded-lg text-center">
              <p className="text-gray-400 text-sm">No clear patterns detected</p>
            </div>
          )}

          <div className="text-xs text-gray-500 text-center">
            ⚠️ Pattern recognition is for informational purposes only. Not financial advice.
          </div>

          <Button
            variant="ghost"
            onClick={() => setAnalysis(null)}
            className="w-full text-gray-400 hover:text-gray-100 hover:bg-gray-700"
          >
            Collapse Analysis
          </Button>
        </div>
      )}
    </div>
  );
}

