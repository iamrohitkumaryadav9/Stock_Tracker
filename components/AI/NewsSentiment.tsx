'use client';

import { useState, useEffect } from 'react';
import { analyzeNewsSentiment, NewsSentimentAnalysis } from '@/lib/actions/ai-analysis.actions';
import { Loader2, Newspaper, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewsSentimentProps {
    symbol: string;
}

const NewsSentiment = ({ symbol }: NewsSentimentProps) => {
    const [loading, setLoading] = useState(true);
    const [sentiment, setSentiment] = useState<NewsSentimentAnalysis | null>(null);

    useEffect(() => {
        const fetchSentiment = async () => {
            try {
                const result = await analyzeNewsSentiment(symbol);
                setSentiment(result);
            } catch (error) {
                console.error('Failed to fetch news sentiment:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSentiment();
    }, [symbol]);

    if (loading) {
        return (
            <div className="bg-[#1E222D] rounded-xl border border-[#2A2E39] p-6 flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (!sentiment) {
        return null; // Don't show if no news/sentiment
    }

    const getSentimentColor = (score: number) => {
        if (score >= 30) return 'text-green-500';
        if (score <= -30) return 'text-red-500';
        return 'text-yellow-500';
    };

    const getSentimentIcon = (score: number) => {
        if (score >= 30) return <TrendingUp className="w-5 h-5 text-green-500" />;
        if (score <= -30) return <TrendingDown className="w-5 h-5 text-red-500" />;
        return <Minus className="w-5 h-5 text-yellow-500" />;
    };

    return (
        <div className="bg-[#1E222D] rounded-xl border border-[#2A2E39] p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Newspaper className="w-5 h-5 text-purple-400" />
                    <h2 className="text-lg font-semibold text-gray-100">News Sentiment</h2>
                </div>
                <div className="flex items-center gap-2 bg-[#2A2E39] px-3 py-1 rounded-full">
                    {getSentimentIcon(sentiment.score)}
                    <span className={cn("font-bold", getSentimentColor(sentiment.score))}>
                        {sentiment.score > 0 ? '+' : ''}{sentiment.score}
                    </span>
                </div>
            </div>

            <p className="text-gray-300 text-sm leading-relaxed">
                {sentiment.summary}
            </p>

            <div className="space-y-3 pt-2">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recent Articles Analyzed</h3>
                {sentiment.articles.map((article, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-[#2A2E39]/50 rounded-lg border border-[#2A2E39]">
                        <div className={cn(
                            "w-1.5 h-1.5 rounded-full mt-2 shrink-0",
                            article.sentiment === 'bullish' ? 'bg-green-500' :
                                article.sentiment === 'bearish' ? 'bg-red-500' : 'bg-yellow-500'
                        )} />
                        <span className="text-sm text-gray-300 line-clamp-2">{article.headline}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NewsSentiment;
