import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTrendingStocks, getAiRecommendations } from '@/lib/actions/discovery.actions';
import { getBacktests } from '@/lib/actions/backtest.actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Search } from 'lucide-react';
import DiscoveryTabs from '@/components/Discovery/DiscoveryTabs';

export default async function DiscoveryPage() {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
        redirect('/sign-in');
    }

    const [trending, recommendations, backtests] = await Promise.all([
        getTrendingStocks(),
        getAiRecommendations(session.user.id),
        getBacktests(session.user.id)
    ]);

    return (
        <div className="w-full min-h-[calc(100vh-64px)] bg-[#0B0E14] p-4 md:p-6 lg:p-8">
            <div className="max-w-[1920px] mx-auto h-full flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-100">Discovery</h1>
                        <p className="text-gray-400">Explore trending assets, market analysis, backtesting, and personalized insights.</p>
                    </div>
                    <Link href="/search">
                        <Button variant="outline" className="gap-2">
                            <Search className="h-4 w-4" />
                            Advanced Search
                        </Button>
                    </Link>
                </div>

                <DiscoveryTabs trending={trending} recommendations={recommendations} backtests={backtests} />
            </div>
        </div>
    );
}
