'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { optimizePortfolio, PortfolioOptimization } from '@/lib/actions/ai-analysis.actions';
import { Loader2, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface PortfolioOptimizerProps {
    positions: any[];
}

const PortfolioOptimizer = ({ positions }: PortfolioOptimizerProps) => {
    const [loading, setLoading] = useState(false);
    const [optimization, setOptimization] = useState<PortfolioOptimization | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const initOptimization = async () => {
            if (!positions || positions.length === 0) return;

            setLoading(true);
            try {
                const result = await optimizePortfolio(positions);
                if (result) {
                    setOptimization(result);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        initOptimization();
    }, [positions]);

    const handleOptimize = async () => {
        if (!positions || positions.length === 0) {
            toast.error('No positions to optimize');
            return;
        }

        setLoading(true);
        setIsOpen(true);
        try {
            const result = await optimizePortfolio(positions);
            if (result) {
                setOptimization(result);
                toast.success('Portfolio optimization complete');
            } else {
                toast.error('Failed to optimize portfolio');
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#1E222D] rounded-xl border border-[#2A2E39] overflow-hidden transition-all duration-300">
            <div
                className="p-4 md:p-6 flex items-center justify-between cursor-pointer hover:bg-[#2A2E39]/50"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    <h2 className="text-lg font-semibold text-gray-100">AI Portfolio Optimizer</h2>
                </div>
                <div className="flex items-center gap-3">
                    {optimization && (
                        <div className="hidden sm:flex items-center gap-2 bg-gray-700/50 px-3 py-1 rounded-full border border-gray-600">
                            <span className="text-xs text-gray-400 uppercase font-medium">Risk Score</span>
                            <span className={`text-sm font-bold ${optimization.riskScore > 70 ? 'text-red-400' :
                                optimization.riskScore > 40 ? 'text-yellow-400' : 'text-green-400'
                                }`}>
                                {optimization.riskScore}/100
                            </span>
                        </div>
                    )}

                    {!optimization && !loading && (
                        <Button
                            onClick={(e) => { e.stopPropagation(); handleOptimize(); }}
                            disabled={loading || positions.length === 0}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white hidden sm:flex"
                        >
                            Optimize
                        </Button>
                    )}

                    {loading && (
                        <div className="flex items-center gap-2 text-sm text-blue-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="hidden sm:inline">Analyzing...</span>
                        </div>
                    )}

                    <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="m6 9 6 6 6-6" /></svg>
                    </div>
                </div>
            </div>

            {isOpen && (
                <div className="p-4 md:p-6 pt-0 border-t border-[#2A2E39] mt-4">
                    {loading && !optimization ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                            <p className="text-gray-400">Analyzing your portfolio structure and risk...</p>
                        </div>
                    ) : !optimization ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in slide-in-from-top-2">
                            <div className="bg-blue-500/10 p-3 rounded-full mb-4">
                                <Sparkles className="w-8 h-8 text-blue-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-200 mb-2">AI-Powered Analysis</h3>
                            <p className="text-gray-400 max-w-md mb-6">
                                Get personalized insights, risk assessment, and rebalancing recommendations for your portfolio using advanced AI.
                            </p>
                            <Button
                                onClick={handleOptimize}
                                disabled={loading || positions.length === 0}
                                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[200px]"
                            >
                                Run Optimization
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="p-4 bg-[#2A2E39] rounded-lg border border-[#363A45]">
                                <h3 className="text-sm font-medium text-gray-400 mb-2">Analysis</h3>
                                <p className="text-gray-200 leading-relaxed">{optimization.analysis}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-[#2A2E39] rounded-lg border border-[#363A45]">
                                    <h3 className="text-sm font-medium text-gray-400 mb-2">Risk Score</h3>
                                    <div className="flex items-center gap-3">
                                        <div className="text-2xl font-bold text-gray-100">{optimization.riskScore}/100</div>
                                        <div className="h-2 flex-1 rounded-full bg-gray-700 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${optimization.riskScore > 70 ? 'bg-red-500' :
                                                    optimization.riskScore > 40 ? 'bg-yellow-500' : 'bg-green-500'
                                                    }`}
                                                style={{ width: `${optimization.riskScore}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-[#2A2E39] rounded-lg border border-[#363A45]">
                                    <h3 className="text-sm font-medium text-gray-400 mb-2">Recommendations</h3>
                                    <div className="space-y-3">
                                        {optimization.recommendations.map((rec, idx) => (
                                            <div key={idx} className="flex items-start gap-3 text-sm">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${rec.action === 'buy' ? 'bg-green-500/20 text-green-400' :
                                                    rec.action === 'sell' ? 'bg-red-500/20 text-red-400' :
                                                        'bg-gray-500/20 text-gray-400'
                                                    }`}>
                                                    {rec.action}
                                                </span>
                                                <div>
                                                    <span className="font-bold text-gray-200">{rec.symbol}</span>
                                                    {rec.quantity && <span className="text-gray-400"> ({rec.quantity} shares)</span>}
                                                    <p className="text-gray-400 mt-0.5">{rec.reason}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PortfolioOptimizer;
