'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calculator, DollarSign, Percent, RefreshCw } from 'lucide-react';

export default function ROICalculator() {
    const [initialInvestment, setInitialInvestment] = useState('');
    const [finalValue, setFinalValue] = useState('');
    const [years, setYears] = useState('');
    const [result, setResult] = useState<{ roi: number; annualizedRoi: number; profit: number } | null>(null);

    const calculateROI = () => {
        const initial = parseFloat(initialInvestment);
        const final = parseFloat(finalValue);
        const period = parseFloat(years);

        if (isNaN(initial) || isNaN(final)) return;

        const profit = final - initial;
        const roi = (profit / initial) * 100;

        let annualizedRoi = 0;
        if (!isNaN(period) && period > 0) {
            annualizedRoi = (Math.pow(final / initial, 1 / period) - 1) * 100;
        }

        setResult({ roi, annualizedRoi, profit });
    };

    const reset = () => {
        setInitialInvestment('');
        setFinalValue('');
        setYears('');
        setResult(null);
    };

    return (
        <Card className="bg-[#1E222D] border-[#2A2E39] text-gray-100 w-full max-w-md mx-auto">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-blue-500" />
                    ROI Calculator
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="initial">Initial Investment ($)</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                            <Input
                                id="initial"
                                type="number"
                                placeholder="1000.00"
                                value={initialInvestment}
                                onChange={(e) => setInitialInvestment(e.target.value)}
                                className="pl-9 bg-[#2A2E39] border-gray-700 text-white"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="final">Final Value ($)</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                            <Input
                                id="final"
                                type="number"
                                placeholder="1500.00"
                                value={finalValue}
                                onChange={(e) => setFinalValue(e.target.value)}
                                className="pl-9 bg-[#2A2E39] border-gray-700 text-white"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="years">Time Period (Years) - Optional</Label>
                        <Input
                            id="years"
                            type="number"
                            placeholder="1"
                            value={years}
                            onChange={(e) => setYears(e.target.value)}
                            className="bg-[#2A2E39] border-gray-700 text-white"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button onClick={calculateROI} className="flex-1 bg-blue-600 hover:bg-blue-700">
                            Calculate
                        </Button>
                        <Button onClick={reset} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800">
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {result && (
                    <div className="bg-[#2A2E39]/50 rounded-lg p-4 space-y-4 border border-[#2A2E39] animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Total Profit</span>
                            <span className={`font-bold ${result.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                ${result.profit.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Total ROI</span>
                            <span className={`font-bold ${result.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {result.roi.toFixed(2)}%
                            </span>
                        </div>
                        {result.annualizedRoi !== 0 && (
                            <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                                <span className="text-gray-400">Annualized ROI</span>
                                <span className={`font-bold ${result.annualizedRoi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {result.annualizedRoi.toFixed(2)}%
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
