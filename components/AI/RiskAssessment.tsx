'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { assessRisk } from '@/lib/actions/ai-analysis.actions';
import type { RiskAssessment } from '@/lib/actions/ai-analysis.actions';
import { toast } from 'sonner';
import { AlertTriangle, Shield, Brain, Loader2, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RiskAssessmentProps {
  symbol: string;
  portfolioSymbols?: string[];
  className?: string;
}

export default function RiskAssessment({ symbol, portfolioSymbols, className }: RiskAssessmentProps) {
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAssess = async () => {
    if (!symbol || symbol.trim() === '') {
      toast.error('Stock symbol is required');
      return;
    }

    setLoading(true);
    setAssessment(null);

    try {
      const result = await assessRisk(symbol, portfolioSymbols);
      if (result) {
        setAssessment(result);
        toast.success('Risk assessment completed');
      } else {
        toast.error('Unable to assess risk. Please try again.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Risk assessment error:', error);
      toast.error(`Error assessing risk: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'text-green-400';
      case 'medium':
        return 'text-yellow-400';
      case 'high':
        return 'text-orange-400';
      case 'very_high':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getRiskBgColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'bg-green-500/20 border-green-500/50';
      case 'medium':
        return 'bg-yellow-500/20 border-yellow-500/50';
      case 'high':
        return 'bg-orange-500/20 border-orange-500/50';
      case 'very_high':
        return 'bg-red-500/20 border-red-500/50';
      default:
        return 'bg-gray-500/20 border-gray-500/50';
    }
  };

  const getVolatilityColor = (volatility: string) => {
    switch (volatility) {
      case 'low':
        return 'text-green-400';
      case 'medium':
        return 'text-yellow-400';
      case 'high':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className={cn('bg-gray-800 border border-gray-600 rounded-lg p-6', className)}>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-yellow-500" />
        <h3 className="text-xl font-bold text-gray-100">Risk Assessment</h3>
      </div>

      <Button
        onClick={handleAssess}
        disabled={loading}
        className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold mb-4"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Assessing...
          </>
        ) : (
          <>
            <Brain className="h-4 w-4 mr-2" />
            Assess Risk
          </>
        )}
      </Button>

      {assessment && (
        <div className="space-y-4">
          {/* Overall Risk Level */}
          <div className={cn('p-4 rounded-lg border-2', getRiskBgColor(assessment.metrics.riskLevel))}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Overall Risk Level</span>
              <div className={cn('flex items-center gap-2 font-bold capitalize', getRiskColor(assessment.metrics.riskLevel))}>
                <AlertTriangle className="h-5 w-5" />
                <span>{assessment.metrics.riskLevel.replace('_', ' ')}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Risk Score</span>
              <span className={cn('font-semibold', getRiskColor(assessment.metrics.riskLevel))}>
                {assessment.metrics.riskScore.toFixed(0)}/100
              </span>
            </div>
          </div>

          {/* Volatility */}
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Volatility</span>
              <div className="flex items-center gap-2">
                <span className={cn('font-semibold capitalize', getVolatilityColor(assessment.metrics.volatility))}>
                  {assessment.metrics.volatility}
                </span>
                <span className="text-gray-500 text-xs">
                  ({assessment.metrics.volatilityScore.toFixed(0)}/100)
                </span>
              </div>
            </div>
          </div>

          {/* Diversification */}
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="mb-2">
              <span className="text-gray-400 text-sm block mb-1">Diversification</span>
              <p className="text-gray-300 text-sm">{assessment.metrics.diversification}</p>
            </div>
          </div>

          {/* Portfolio Risk (if available) */}
          {assessment.portfolioRisk && (
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-yellow-500" />
                <span className="text-gray-400 text-sm font-semibold">Portfolio Risk</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Concentration</span>
                  <span className="text-gray-100">{assessment.portfolioRisk.concentration.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Sector Risk</span>
                  <span className="text-gray-100">{assessment.portfolioRisk.sectorRisk}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Overall Portfolio Risk</span>
                  <span className={cn('font-semibold capitalize', getRiskColor(assessment.portfolioRisk.overallRisk))}>
                    {assessment.portfolioRisk.overallRisk}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {assessment.metrics.recommendations.length > 0 && (
            <div className="bg-gray-700 p-4 rounded-lg">
              <span className="text-gray-400 text-sm block mb-2">Recommendations</span>
              <ul className="space-y-1">
                {assessment.metrics.recommendations.map((rec, index) => (
                  <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Summary */}
          <div className="bg-gray-700 p-4 rounded-lg">
            <span className="text-gray-400 text-sm block mb-1">Summary</span>
            <p className="text-gray-300 text-sm">{assessment.summary}</p>
          </div>

          <div className="text-xs text-gray-500 text-center">
            ⚠️ Risk assessment is for informational purposes only. Not financial advice.
          </div>

          <Button
            variant="ghost"
            onClick={() => setAssessment(null)}
            className="w-full text-gray-400 hover:text-gray-100 hover:bg-gray-700"
          >
            Collapse Analysis
          </Button>
        </div>
      )}
    </div>
  );
}

