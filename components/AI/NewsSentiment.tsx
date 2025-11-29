'use client';

'use client';

import { useState, useEffect } from 'react';
import { analyzeNewsSentiment, NewsSentimentAnalysis } from '@/lib/actions/ai-analysis.actions';
import { Loader2, Newspaper, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NewsSentimentProps {
    symbol: string;
    className?: string;
}

const NewsSentiment = ({ symbol, className }: NewsSentimentProps) => {
    const [loading, setLoading] = useState(true);
    const [sentiment, setSentiment] = useState<NewsSentimentAnalysis | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);

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

    const getSentimentColor = (score: number) => {
        if (score >= 30) return 'text-green-400';
        if (score <= -30) return 'text-red-400';
        return 'text-yellow-500';
    };

    const getSentimentIcon = (score: number) => {
        if (score >= 30) return <TrendingUp className="h-5 w-5 text-green-400" />;
        if (score <= -30) return <TrendingDown className="h-5 w-5 text-red-400" />;
        return <Minus className="h-5 w-5 text-yellow-500" />;
    };

    if (loading) {
        return (
            <div className={cn("bg-gray-800 border border-gray-600 rounded-lg p-6 flex items-center justify-center min-h-[200px]", className)}>
                <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />
            </div>
        );
    }

    if (!sentiment) {
        return null;
    }

    return (
        <div className={cn("bg-gray-800 border border-gray-600 rounded-lg p-6", className)}>
            <div
                className="flex items-center justify-between cursor-pointer mb-4"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <Newspaper className="h-5 w-5 text-yellow-500" />
                    <h3 className="text-xl font-bold text-gray-100">News Sentiment</h3>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded-full">
                        {getSentimentIcon(sentiment.score)}
                        <span className={cn("font-bold text-sm", getSentimentColor(sentiment.score))}>
                            {sentiment.score > 0 ? '+' : ''}{sentiment.score}
                        </span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
            </div>

            {isExpanded && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <span className="text-gray-400 text-sm block mb-2">Summary</span>
                        <p className="text-gray-300 text-sm leading-relaxed">
                            {sentiment.summary}
                        </p>
                    </div>

                    <div className="bg-gray-700 p-4 rounded-lg">
                        <span className="text-gray-400 text-sm block mb-3">Recent Articles</span>
                        <div className="space-y-3">
                            {sentiment.articles.map((article, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-600 hover:border-gray-500 transition-colors">
                                    <div className={cn(
                                        "w-2 h-2 rounded-full mt-2 shrink-0",
                                        article.sentiment === 'bullish' ? 'bg-green-500' :
                                            article.sentiment === 'bearish' ? 'bg-red-500' : 'bg-yellow-500'
                                    )} />
                                    <div className="flex-1 min-w-0">
                                        <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-200 hover:text-yellow-500 font-medium line-clamp-2 transition-colors block">
                                            {article.headline}
                                        </a>
                                        <div className="flex items-center gap-2 mt-1">
                                            {article.datetime && (
                                                <span className="text-xs text-gray-500">
                                                    {new Date(article.datetime * 1000).toLocaleDateString()}
                                                </span>
                                            )}
                                            <span className={cn(
                                                "text-[10px] px-1.5 py-0.5 rounded uppercase font-medium",
                                                article.sentiment === 'bullish' ? 'bg-green-500/10 text-green-400' :
                                                    article.sentiment === 'bearish' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-500'
                                            )}>
                                                {article.sentiment}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewsSentiment;
