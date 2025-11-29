import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { getTransactionHistory } from '@/lib/actions/portfolio.actions';
import ReportsClient from './reports-client';

export default async function ReportsPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    if (!userId) {
        return <div>Please log in to view reports.</div>;
    }

    const transactions = await getTransactionHistory(userId, 1000); // Fetch all transactions

    return (
        <div className="min-h-screen bg-[#0B0E14] text-gray-100 p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                <ReportsClient transactions={transactions} />
            </div>
        </div>
    );
}
