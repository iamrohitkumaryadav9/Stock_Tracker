'use client';

import { useState } from 'react';
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

    const handleOptimize = async () => {
        if (!positions || positions.length === 0) {
            toast.error('No positions to optimize');
            return;
        }

        setLoading(true);
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
        <div className="bg-[#1E222D] rounded-xl border border-[#2A2E39] p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    <h2 className="text-lg font-semibold text-gray-100">AI Portfolio Optimizer</h2>
                </div>
                <Button
                    onClick={handleOptimize}
                    disabled={loading || positions.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Optimizing...
                        </>
                    ) : (
                        'Optimize Portfolio'
                    )}
                </Button>
            </div>

            {optimization && (
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
                                <div className={`h-2 flex-1 rounded-full bg-gray-700 overflow-hidden`}>
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
    );
};

export default PortfolioOptimizer;
