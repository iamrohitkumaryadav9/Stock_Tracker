'use client';

import { useState, useEffect } from 'react';
import { analyzePortfolioNews, PortfolioNewsSummary } from '@/lib/actions/ai-analysis.actions';
import { Loader2, Newspaper, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PortfolioNewsProps {
    positions: any[];
    className?: string;
}

const PortfolioNews = ({ positions, className }: PortfolioNewsProps) => {
    const [loading, setLoading] = useState(true);
    const [newsSummary, setNewsSummary] = useState<PortfolioNewsSummary | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        const fetchNews = async () => {
            if (!positions || positions.length === 0) {
                setLoading(false);
                return;
            }

            try {
                const symbols = positions.map((p: any) => p.symbol);
                const result = await analyzePortfolioNews(symbols);
                setNewsSummary(result);
            } catch (error) {
                console.error('Failed to fetch portfolio news:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, [positions]);

    if (!positions || positions.length === 0) return null;

    if (loading) {
        return (
            <div className={cn("bg-gray-800 border border-gray-600 rounded-lg p-6 flex items-center justify-center min-h-[150px]", className)}>
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (!newsSummary) return null;

    const getImpactColor = (impact: string) => {
        if (impact === 'positive') return 'text-green-400';
        if (impact === 'negative') return 'text-red-400';
        return 'text-yellow-500';
    };

    const getImpactIcon = (impact: string) => {
        if (impact === 'positive') return <TrendingUp className="h-5 w-5 text-green-400" />;
        if (impact === 'negative') return <TrendingDown className="h-5 w-5 text-red-400" />;
        return <Minus className="h-5 w-5 text-yellow-500" />;
    };

    return (
        <div className={cn("bg-gray-800 border border-gray-600 rounded-lg p-6", className)}>
            <div
                className="flex items-center justify-between cursor-pointer mb-4"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <Newspaper className="h-5 w-5 text-blue-400" />
                    <h3 className="text-xl font-bold text-gray-100">Morning Briefing</h3>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded-full">
                        {getImpactIcon(newsSummary.impact)}
                        <span className={cn("font-bold text-sm capitalize", getImpactColor(newsSummary.impact))}>
                            {newsSummary.impact} Impact
                        </span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
            </div>

            {isExpanded && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <p className="text-gray-300 text-sm leading-relaxed">
                            {newsSummary.summary}
                        </p>
                    </div>

                    {newsSummary.keyEvents.length > 0 && (
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <span className="text-gray-400 text-sm block mb-2">Key Events</span>
                            <ul className="space-y-2">
                                {newsSummary.keyEvents.map((event, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-200">
                                        <span className="text-blue-500 mt-1">•</span>
                                        <span>{event}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PortfolioNews;
