import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPortfolio, getTransactionHistory } from '@/lib/actions/portfolio.actions';
import PortfolioSummary from '@/components/PaperTrading/PortfolioSummary';
import PositionsTable from '@/components/PaperTrading/PositionsTable';
import TransactionHistory from '@/components/PaperTrading/TransactionHistory';
import AdvancedTradingTabs from '@/components/AdvancedTrading/AdvancedTradingTabs';
import PortfolioOptimizer from '@/components/AI/PortfolioOptimizer';

export default async function PortfolioPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/sign-in');
  }

  const userId = session.user.id;
  const portfolio = await getPortfolio(userId);
  const transactions = await getTransactionHistory(userId, 100);

  if (!portfolio) {
    return (
      <div className="container py-10">
        <h1 className="text-3xl font-bold text-gray-100 mb-6">Portfolio</h1>
        <p className="text-gray-400">Error loading portfolio. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="w-full py-10 px-4 md:px-6 lg:px-8">
      <div className="max-w-screen-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-100 mb-6">Paper Trading Portfolio</h1>

        <PortfolioSummary portfolio={portfolio} />

        <div className="mb-6">
          <PortfolioOptimizer positions={portfolio.positions} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">Positions</h2>
            <PositionsTable positions={portfolio.positions} />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-4">Advanced Trading</h2>
            <AdvancedTradingTabs
              userId={userId}
            />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Transaction History</h2>
          <TransactionHistory transactions={transactions} />
        </div>
      </div>
    </div>
  );
}

