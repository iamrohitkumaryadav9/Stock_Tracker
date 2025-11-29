import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import Leaderboard from '@/components/Competitions/Leaderboard';

export default async function CompetitionsPage() {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
        return <div>Please log in to view competitions.</div>;
    }

    return (
        <div className="min-h-screen bg-[#0B0E14] text-gray-100 p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Paper Trading Competition</h1>
                    <p className="text-gray-400">Compete with other traders and climb the leaderboard based on your portfolio performance.</p>
                </div>

                <Leaderboard />
            </div>
        </div>
    );
}
