'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { analyzeSentiment } from '@/lib/actions/ai-analysis.actions';
import type { SentimentAnalysis } from '@/lib/actions/ai-analysis.actions';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Minus, Brain, Loader2, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SentimentAnalysisProps {
  symbol: string;
  className?: string;
}

export default function SentimentAnalysis({ symbol, className }: SentimentAnalysisProps) {
  const [analysis, setAnalysis] = useState<SentimentAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!symbol || symbol.trim() === '') {
      toast.error('Stock symbol is required');
      return;
    }

    setLoading(true);
    setAnalysis(null);

    try {
      const result = await analyzeSentiment(symbol);
      if (result) {
        setAnalysis(result);
        toast.success('Sentiment analysis completed');
      } else {
        toast.error('Unable to analyze sentiment. Please try again.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Sentiment analysis error:', error);
      toast.error(`Error analyzing sentiment: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'very_bullish':
        return 'text-green-400';
      case 'bullish':
        return 'text-green-300';
      case 'neutral':
        return 'text-gray-400';
      case 'bearish':
        return 'text-red-300';
      case 'very_bearish':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'very_bullish':
      case 'bullish':
        return <TrendingUp className="h-5 w-5" />;
      case 'bearish':
      case 'very_bearish':
        return <TrendingDown className="h-5 w-5" />;
      default:
        return <Minus className="h-5 w-5" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 50) return 'text-green-400';
    if (score >= 0) return 'text-green-300';
    if (score >= -50) return 'text-red-300';
    return 'text-red-400';
  };

  return (
    <div className={cn('bg-gray-800 border border-gray-600 rounded-lg p-6', className)}>
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-yellow-500" />
        <h3 className="text-xl font-bold text-gray-100">Sentiment Analysis</h3>
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
            Analyze Sentiment
          </>
        )}
      </Button>

      {analysis && (
        <div className="space-y-4">
          {/* Overall Sentiment */}
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Overall Sentiment</span>
              <div className={cn('flex items-center gap-2 font-bold', getSentimentColor(analysis.overallSentiment))}>
                {getSentimentIcon(analysis.overallSentiment)}
                <span className="capitalize">{analysis.overallSentiment.replace('_', ' ')}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Sentiment Score</span>
              <span className={cn('font-semibold', getScoreColor(analysis.sentimentScore))}>
                {analysis.sentimentScore > 0 ? '+' : ''}{analysis.sentimentScore.toFixed(1)}
              </span>
            </div>
          </div>

          {/* News Sentiment */}
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">News Sentiment</span>
              <span className={cn('font-semibold', getScoreColor(analysis.newsSentiment.score))}>
                {analysis.newsSentiment.score > 0 ? '+' : ''}{analysis.newsSentiment.score.toFixed(1)}
              </span>
            </div>
            <p className="text-gray-300 text-sm mt-2">{analysis.newsSentiment.summary}</p>
          </div>

          {/* Social Sentiment */}
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Social Sentiment</span>
              <div className="flex items-center gap-2">
                <span className={cn('font-semibold', getScoreColor(analysis.socialSentiment.score))}>
                  {analysis.socialSentiment.score > 0 ? '+' : ''}{analysis.socialSentiment.score.toFixed(1)}
                </span>
                <span className="text-gray-500 text-xs">({analysis.socialSentiment.postCount} posts)</span>
              </div>
            </div>
            <p className="text-gray-300 text-sm mt-2">{analysis.socialSentiment.summary}</p>
          </div>

          {/* Key Factors */}
          {analysis.keyFactors.length > 0 && (
            <div className="bg-gray-700 p-4 rounded-lg">
              <span className="text-gray-400 text-sm block mb-2">Key Factors</span>
              <ul className="space-y-1">
                {analysis.keyFactors.map((factor, index) => (
                  <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-xs text-gray-500 text-center">
            ⚠️ Sentiment analysis is for informational purposes only. Not financial advice.
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

