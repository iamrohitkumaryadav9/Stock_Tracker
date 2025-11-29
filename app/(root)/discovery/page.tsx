import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTrendingStocks, getAiRecommendations } from '@/lib/actions/discovery.actions';
import TrendingSection from '@/components/Discovery/TrendingSection';
import AiRecommendations from '@/components/Discovery/AiRecommendations';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Search } from 'lucide-react';

export default async function DiscoveryPage() {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
        redirect('/sign-in');
    }

    const [trending, recommendations] = await Promise.all([
        getTrendingStocks(),
        getAiRecommendations(session.user.id)
    ]);

    return (
        <div className="w-full py-10 px-4 md:px-6 lg:px-8">
            <div className="max-w-screen-xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-100">Discovery</h1>
                        <p className="text-gray-400">Explore trending assets and personalized insights.</p>
                    </div>
                    <Link href="/search">
                        <Button variant="outline" className="gap-2">
                            <Search className="h-4 w-4" />
                            Advanced Search
                        </Button>
                    </Link>
                </div>

                {/* Trending Section */}
                <TrendingSection trending={trending} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* AI Recommendations */}
                    <div className="lg:col-span-2">
                        <AiRecommendations data={recommendations} />
                    </div>

                    {/* Quick Links / Categories */}
                    <div className="space-y-6">
                        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                            <h3 className="text-lg font-semibold text-gray-100 mb-4">Explore by Category</h3>
                            <div className="flex flex-wrap gap-2">
                                {['Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer', 'Crypto', 'ETFs'].map(cat => (
                                    <Link key={cat} href={`/search?q=${cat}&type=stocks`}>
                                        <span className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-full text-sm cursor-pointer transition-colors">
                                            {cat}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-6">
                            <h3 className="text-lg font-semibold text-blue-100 mb-2">Watchlist Suggestions</h3>
                            <p className="text-sm text-blue-200/70 mb-4">
                                Based on your recent activity, we think you might like these.
                            </p>
                            <div className="space-y-2">
                                {/* Mock suggestions for visual completeness, real ones come from AI Recs above */}
                                <Link href="/stocks/AMZN" className="block p-2 bg-blue-900/30 rounded hover:bg-blue-900/50 transition-colors">
                                    <div className="flex justify-between">
                                        <span className="font-bold text-blue-100">AMZN</span>
                                        <span className="text-green-400">+1.2%</span>
                                    </div>
                                    <div className="text-xs text-blue-300">E-commerce giant</div>
                                </Link>
                                <Link href="/stocks/GOOGL" className="block p-2 bg-blue-900/30 rounded hover:bg-blue-900/50 transition-colors">
                                    <div className="flex justify-between">
                                        <span className="font-bold text-blue-100">GOOGL</span>
                                        <span className="text-green-400">+0.8%</span>
                                    </div>
                                    <div className="text-xs text-blue-300">Search & AI leader</div>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
