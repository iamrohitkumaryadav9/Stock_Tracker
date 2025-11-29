import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPortfolio, getTransactionHistory } from '@/lib/actions/portfolio.actions';
import { getJournalEntries } from '@/lib/actions/journal.actions';
import { assessRisk } from '@/lib/actions/ai-analysis.actions';
import ResourcesTabs from '@/components/Resources/ResourcesTabs';

export default async function ResourcesPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    if (!userId) {
        redirect('/sign-in');
    }

    // Fetch data for Analytics, Reports, and Journal
    const [portfolio, transactions, journalEntries] = await Promise.all([
        getPortfolio(userId),
        getTransactionHistory(userId, 1000),
        getJournalEntries(userId)
    ]);

    // Calculate Sector Allocation (Mock logic from original Analytics page)
    const positions = portfolio?.positions || [];
    const sectorMap = new Map<string, number>();
    const mockSectors = ['Technology', 'Finance', 'Healthcare', 'Consumer', 'Energy'];

    positions.forEach((pos: any) => {
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
            riskAssessment = await assessRisk(positions[0].symbol, positions.map((p: any) => p.symbol));
        } catch (e) {
            console.error("Failed to fetch risk assessment", e);
        }
    }

    const analyticsData = {
        portfolio,
        sectorData,
        riskAssessment
    };

    return (
        <div className="w-full min-h-screen bg-[#0B0E14] p-4 md:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-100 mb-8">Resources & Tools</h1>
                <ResourcesTabs
                    userId={userId}
                    analyticsData={analyticsData}
                    transactions={transactions}
                    journalEntries={journalEntries}
                />
            </div>
        </div>
    );
}
