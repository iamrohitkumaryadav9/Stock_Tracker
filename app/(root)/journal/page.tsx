import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { getJournalEntries } from '@/lib/actions/journal.actions';
import JournalClient from './journal-client';

export default async function JournalPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    if (!userId) {
        return <div>Please log in to view your journal.</div>;
    }

    const entries = await getJournalEntries(userId);

    return (
        <div className="min-h-screen bg-[#0B0E14] text-gray-100 p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Trade Journal</h1>
                        <p className="text-gray-400">Log your trades, track your emotions, and learn from your history.</p>
                    </div>
                </div>

                <JournalClient initialEntries={entries} userId={userId} />
            </div>
        </div>
    );
}
