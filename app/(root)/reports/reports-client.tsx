'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Printer, Download, FileText, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

interface Transaction {
    assetType: 'stock' | 'crypto' | 'forex' | 'futures' | 'options';
    symbol: string;
    type: 'buy' | 'sell';
    quantity: number;
    price: number;
    totalAmount: number;
    timestamp: Date;
}

interface ReportsClientProps {
    transactions: Transaction[];
}

export default function ReportsClient({ transactions }: ReportsClientProps) {
    const [year, setYear] = useState(new Date().getFullYear());

    const reportData = useMemo(() => {
        let realizedGains = 0;
        let totalBuyVolume = 0;
        let totalSellVolume = 0;
        const symbolGains: Record<string, number> = {};

        // Simple FIFO calculation for realized gains
        // This is a simplified estimation. A real tax engine is much more complex.
        const holdings: Record<string, { quantity: number; cost: number }[]> = {};

        // Sort transactions by date ascending
        const sortedTx = [...transactions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        sortedTx.forEach(tx => {
            const txYear = new Date(tx.timestamp).getFullYear();

            if (tx.type === 'buy') {
                if (txYear === year) totalBuyVolume += tx.totalAmount;

                if (!holdings[tx.symbol]) holdings[tx.symbol] = [];
                holdings[tx.symbol].push({ quantity: tx.quantity, cost: tx.totalAmount });
            } else if (tx.type === 'sell') {
                if (txYear === year) totalSellVolume += tx.totalAmount;

                let remainingQtyToSell = tx.quantity;
                let costBasis = 0;

                if (holdings[tx.symbol]) {
                    while (remainingQtyToSell > 0 && holdings[tx.symbol].length > 0) {
                        const batch = holdings[tx.symbol][0];

                        if (batch.quantity <= remainingQtyToSell) {
                            // Sold entire batch
                            costBasis += batch.cost;
                            remainingQtyToSell -= batch.quantity;
                            holdings[tx.symbol].shift(); // Remove batch
                        } else {
                            // Partial sale of batch
                            const fraction = remainingQtyToSell / batch.quantity;
                            costBasis += batch.cost * fraction;
                            batch.cost -= batch.cost * fraction;
                            batch.quantity -= remainingQtyToSell;
                            remainingQtyToSell = 0;
                        }
                    }
                }

                const gain = tx.totalAmount - costBasis;
                if (txYear === year) {
                    realizedGains += gain;
                    symbolGains[tx.symbol] = (symbolGains[tx.symbol] || 0) + gain;
                }
            }
        });

        return {
            realizedGains,
            totalBuyVolume,
            totalSellVolume,
            symbolGains
        };
    }, [transactions, year]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-8 print:p-0 print:bg-white print:text-black">
            <div className="flex items-center justify-between print:hidden">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Financial Reports</h1>
                    <p className="text-gray-400">View performance summaries and tax reports.</p>
                </div>
                <Button onClick={handlePrint} variant="outline" className="gap-2">
                    <Printer className="w-4 h-4" />
                    Print / Save PDF
                </Button>
            </div>

            <div className="print:block hidden mb-8">
                <h1 className="text-2xl font-bold">Annual Financial Report - {year}</h1>
                <p className="text-sm text-gray-500">Generated on {new Date().toLocaleDateString()}</p>
            </div>

            <Tabs defaultValue="tax" className="w-full print:hidden">
                <TabsList className="bg-[#1E222D] border border-[#2A2E39]">
                    <TabsTrigger value="tax">Tax Report</TabsTrigger>
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                </TabsList>

                <TabsContent value="tax" className="mt-6">
                    <TaxReportContent year={year} data={reportData} />
                </TabsContent>

                <TabsContent value="performance" className="mt-6">
                    <PerformanceReportContent year={year} data={reportData} />
                </TabsContent>
            </Tabs>

            {/* Visible only when printing */}
            <div className="hidden print:block space-y-8">
                <TaxReportContent year={year} data={reportData} />
                <div className="break-before-page" />
                <PerformanceReportContent year={year} data={reportData} />
            </div>
        </div>
    );
}

function TaxReportContent({ year, data }: { year: number; data: any }) {
    return (
        <Card className="bg-[#1E222D] border-[#2A2E39] text-gray-100 print:bg-white print:text-black print:border-gray-200 print:shadow-none">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    Tax Summary ({year})
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 bg-[#2A2E39] rounded-lg print:bg-gray-100 print:border">
                        <span className="text-sm text-gray-400 print:text-gray-600">Realized Gains/Losses</span>
                        <div className={`text-2xl font-bold ${data.realizedGains >= 0 ? 'text-green-500' : 'text-red-500'} print:text-black`}>
                            ${data.realizedGains.toFixed(2)}
                        </div>
                    </div>
                    <div className="p-4 bg-[#2A2E39] rounded-lg print:bg-gray-100 print:border">
                        <span className="text-sm text-gray-400 print:text-gray-600">Total Proceeds (Sells)</span>
                        <div className="text-2xl font-bold text-gray-100 print:text-black">
                            ${data.totalSellVolume.toFixed(2)}
                        </div>
                    </div>
                    <div className="p-4 bg-[#2A2E39] rounded-lg print:bg-gray-100 print:border">
                        <span className="text-sm text-gray-400 print:text-gray-600">Total Cost Basis (Buys)</span>
                        <div className="text-2xl font-bold text-gray-100 print:text-black">
                            ${data.totalBuyVolume.toFixed(2)}
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-4">Realized Gains by Symbol</h3>
                    <div className="border border-[#2A2E39] rounded-lg overflow-x-auto print:border-gray-300">
                        <table className="w-full text-sm text-left min-w-[300px]">
                            <thead className="bg-[#2A2E39] text-gray-400 print:bg-gray-100 print:text-gray-700">
                                <tr>
                                    <th className="p-3">Symbol</th>
                                    <th className="p-3 text-right">Realized Gain/Loss</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2A2E39] print:divide-gray-200">
                                {Object.entries(data.symbolGains).map(([symbol, gain]: [string, any]) => (
                                    <tr key={symbol} className="hover:bg-[#2A2E39]/50 print:hover:bg-transparent">
                                        <td className="p-3 font-medium">{symbol}</td>
                                        <td className={`p-3 text-right font-bold ${gain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {gain >= 0 ? '+' : ''}{gain.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                                {Object.keys(data.symbolGains).length === 0 && (
                                    <tr>
                                        <td colSpan={2} className="p-4 text-center text-gray-500">No realized gains recorded for this year.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function PerformanceReportContent({ year, data }: { year: number; data: any }) {
    return (
        <Card className="bg-[#1E222D] border-[#2A2E39] text-gray-100 print:bg-white print:text-black print:border-gray-200 print:shadow-none">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                    Performance Overview ({year})
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <p className="text-gray-300 print:text-gray-700">
                        This report summarizes your trading activity and performance for the fiscal year {year}.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 border border-[#2A2E39] rounded-lg print:border-gray-300">
                            <h4 className="text-sm font-medium text-gray-400 mb-1">Trading Volume</h4>
                            <p className="text-xl font-bold">${(data.totalBuyVolume + data.totalSellVolume).toFixed(2)}</p>
                        </div>
                        <div className="p-4 border border-[#2A2E39] rounded-lg print:border-gray-300">
                            <h4 className="text-sm font-medium text-gray-400 mb-1">Net Profit</h4>
                            <p className={`text-xl font-bold ${data.realizedGains >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                ${data.realizedGains.toFixed(2)}
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
