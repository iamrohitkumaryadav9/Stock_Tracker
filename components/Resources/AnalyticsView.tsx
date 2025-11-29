'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Simple SVG Pie Chart Component
const SimplePieChart = ({ data }: { data: { name: string; value: number; color: string }[] }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = 0;

    if (total === 0) return <div className="text-center text-gray-500">No data available</div>;

    return (
        <div className="flex items-center justify-center gap-8">
            <div className="relative w-64 h-64">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {data.map((item, index) => {
                        const angle = (item.value / total) * 360;

                        // Handle 100% case (360 degrees) where arc command fails
                        if (angle >= 359.9) {
                            return <circle key={index} cx="50" cy="50" r="50" fill={item.color} />;
                        }

                        const x1 = 50 + 50 * Math.cos((Math.PI * currentAngle) / 180);
                        const y1 = 50 + 50 * Math.sin((Math.PI * currentAngle) / 180);
                        const x2 = 50 + 50 * Math.cos((Math.PI * (currentAngle + angle)) / 180);
                        const y2 = 50 + 50 * Math.sin((Math.PI * (currentAngle + angle)) / 180);

                        const largeArcFlag = angle > 180 ? 1 : 0;

                        const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

                        const path = <path key={index} d={pathData} fill={item.color} />;
                        currentAngle += angle;
                        return path;
                    })}
                    <circle cx="50" cy="50" r="30" fill="#1E222D" />
                </svg>
            </div>
            <div className="space-y-2">
                {data.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-gray-300">{item.name}</span>
                        <span className="text-sm font-bold text-gray-100">{((item.value / total) * 100).toFixed(1)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface AnalyticsViewProps {
    portfolio: any;
    sectorData: any[];
    riskAssessment: any;
}

export default function AnalyticsView({ portfolio, sectorData, riskAssessment }: AnalyticsViewProps) {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="bg-[#1E222D] border-[#2A2E39] text-gray-100">
                    <CardHeader>
                        <CardTitle className="text-lg">Total Value</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">${portfolio?.currentValue.toFixed(2)}</div>
                        <div className={`text-sm ${portfolio?.totalReturn && portfolio.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {portfolio?.totalReturn && portfolio.totalReturn >= 0 ? '+' : ''}{portfolio?.totalReturn.toFixed(2)} ({portfolio?.totalReturnPercent.toFixed(2)}%)
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#1E222D] border-[#2A2E39] text-gray-100">
                    <CardHeader>
                        <CardTitle className="text-lg">Cash Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">${portfolio?.cashBalance.toFixed(2)}</div>
                        <div className="text-sm text-gray-400">Available for trading</div>
                    </CardContent>
                </Card>

                <Card className="bg-[#1E222D] border-[#2A2E39] text-gray-100">
                    <CardHeader>
                        <CardTitle className="text-lg">Risk Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-yellow-500">{riskAssessment?.metrics.riskScore || 50}/100</div>
                        <div className="text-sm text-gray-400">{riskAssessment?.metrics.riskLevel || 'Medium'} Risk</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-[#1E222D] border-[#2A2E39] text-gray-100">
                    <CardHeader>
                        <CardTitle>Sector Allocation</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <SimplePieChart data={sectorData} />
                    </CardContent>
                </Card>

                <Card className="bg-[#1E222D] border-[#2A2E39] text-gray-100">
                    <CardHeader>
                        <CardTitle>AI Risk Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {riskAssessment ? (
                            <div className="space-y-4">
                                <div>
                                    <span className="text-gray-400 text-sm">Diversification</span>
                                    <p className="text-gray-200">{riskAssessment.metrics.diversification}</p>
                                </div>
                                <div>
                                    <span className="text-gray-400 text-sm">Recommendations</span>
                                    <ul className="list-disc list-inside text-gray-200 text-sm mt-1">
                                        {riskAssessment.metrics.recommendations.map((rec: string, i: number) => (
                                            <li key={i}>{rec}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <span className="text-gray-400 text-sm">Summary</span>
                                    <p className="text-gray-300 text-sm">{riskAssessment.summary}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-gray-500">Not enough data for risk analysis.</div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
