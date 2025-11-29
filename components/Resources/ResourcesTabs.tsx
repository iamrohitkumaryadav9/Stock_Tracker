'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart2, FileText, Trophy, Layout, BookOpen, Calculator } from 'lucide-react';
import AnalyticsView from './AnalyticsView';
import ReportsClient from '@/app/(root)/reports/reports-client';
import Leaderboard from '@/components/Competitions/Leaderboard';
import PortfolioTemplates from '@/components/Tools/PortfolioTemplates';
import JournalClient from '@/app/(root)/journal/journal-client';
import ROICalculator from '@/components/tools/ROICalculator';

interface ResourcesTabsProps {
    userId: string;
    analyticsData: {
        portfolio: any;
        sectorData: any[];
        riskAssessment: any;
    };
    transactions: any[];
    journalEntries: any[];
}

export default function ResourcesTabs({ userId, analyticsData, transactions, journalEntries }: ResourcesTabsProps) {
    return (
        <Tabs defaultValue="analytics" className="w-full">
            <TabsList className="bg-gray-800 border-gray-700 w-full md:w-fit mb-6 grid grid-cols-3 md:flex flex-wrap h-auto gap-2">
                <TabsTrigger value="analytics" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    <BarChart2 className="h-4 w-4" />
                    Analytics
                </TabsTrigger>
                <TabsTrigger value="reports" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    <FileText className="h-4 w-4" />
                    Reports
                </TabsTrigger>
                <TabsTrigger value="journal" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    <BookOpen className="h-4 w-4" />
                    Journal
                </TabsTrigger>
                <TabsTrigger value="competitions" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    <Trophy className="h-4 w-4" />
                    Competitions
                </TabsTrigger>
                <TabsTrigger value="templates" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    <Layout className="h-4 w-4" />
                    Templates
                </TabsTrigger>
                <TabsTrigger value="roi" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    <Calculator className="h-4 w-4" />
                    ROI Calc
                </TabsTrigger>
            </TabsList>

            <TabsContent value="analytics" className="mt-0">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-100">Portfolio Analytics</h2>
                    <p className="text-gray-400">Deep dive into your portfolio performance and risk metrics.</p>
                </div>
                <AnalyticsView
                    portfolio={analyticsData.portfolio}
                    sectorData={analyticsData.sectorData}
                    riskAssessment={analyticsData.riskAssessment}
                />
            </TabsContent>

            <TabsContent value="reports" className="mt-0">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-100">Financial Reports</h2>
                    <p className="text-gray-400">Generate and view detailed reports of your trading activity.</p>
                </div>
                <ReportsClient transactions={transactions} />
            </TabsContent>

            <TabsContent value="journal" className="mt-0">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-100">Trade Journal</h2>
                    <p className="text-gray-400">Log your trades, track your emotions, and learn from your history.</p>
                </div>
                <JournalClient initialEntries={journalEntries} userId={userId} />
            </TabsContent>

            <TabsContent value="competitions" className="mt-0">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-100">Paper Trading Competition</h2>
                    <p className="text-gray-400">Compete with other traders and climb the leaderboard.</p>
                </div>
                <Leaderboard />
            </TabsContent>

            <TabsContent value="templates" className="mt-0">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-100">Portfolio Templates</h2>
                    <p className="text-gray-400">Jumpstart your portfolio with pre-built strategies.</p>
                </div>
                <PortfolioTemplates userId={userId} />
            </TabsContent>

            <TabsContent value="roi" className="mt-0">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-100">ROI Calculator</h2>
                    <p className="text-gray-400">Calculate your return on investment and plan your financial goals.</p>
                </div>
                <div className="max-w-md mx-auto">
                    <ROICalculator />
                </div>
            </TabsContent>
        </Tabs>
    );
}
