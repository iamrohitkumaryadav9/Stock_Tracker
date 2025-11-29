import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { getPortfolio, getTransactionHistory } from '@/lib/actions/portfolio.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { assessRisk } from '@/lib/actions/ai-analysis.actions';

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

export default async function AnalyticsPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    if (!userId) {
        return <div>Please log in to view analytics.</div>;
    }

    const portfolio = await getPortfolio(userId);
    const transactions = await getTransactionHistory(userId, 100);

    // Calculate Sector Allocation (Mocking sectors for now as we don't have them in DB)
    // In a real app, we'd fetch company profile to get sector
    const positions = portfolio?.positions || [];
    const sectorMap = new Map<string, number>();

    // Mock sector assignment based on symbol hash or predefined list for demo
    const mockSectors = ['Technology', 'Finance', 'Healthcare', 'Consumer', 'Energy'];

    positions.forEach(pos => {
        // Simple mock logic to distribute sectors for visualization
        const sectorIndex = pos.symbol.length % mockSectors.length;
        const sector = mockSectors[sectorIndex];
        const currentVal = sectorMap.get(sector) || 0;
        sectorMap.set(sector, currentVal + pos.currentValue);
    });

    const sectorData = Array.from(sectorMap.entries()).map(([name, value], index) => ({
        name,
        value,
        color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][index % 5]
    }));

    // AI Risk Assessment
    let riskAssessment = null;
    if (positions.length > 0) {
        try {
            riskAssessment = await assessRisk(positions[0].symbol, positions.map(p => p.symbol));
        } catch (e) {
            console.error("Failed to fetch risk assessment", e);
        }
    }

    return (
        <div className="min-h-screen bg-[#0B0E14] text-gray-100 p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Portfolio Analytics</h1>
                <p className="text-gray-400 mb-8">Deep dive into your portfolio performance and risk metrics.</p>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
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
                                            {riskAssessment.metrics.recommendations.map((rec, i) => (
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
        </div>
    );
}
