import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import PortfolioTemplates from '@/components/Tools/PortfolioTemplates';

export default async function TemplatesPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    if (!userId) {
        return <div>Please log in to view templates.</div>;
    }

    return (
        <div className="min-h-screen bg-[#0B0E14] text-gray-100 p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Portfolio Templates</h1>
                    <p className="text-gray-400">Jumpstart your portfolio with pre-built strategies designed by experts.</p>
                </div>

                <PortfolioTemplates userId={userId} />
            </div>
        </div>
    );
}
