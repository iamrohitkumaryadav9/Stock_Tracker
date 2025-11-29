import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPortfolio, getTransactionHistory, getPortfolios } from '@/lib/actions/portfolio.actions';
import PortfolioSummary from '@/components/PaperTrading/PortfolioSummary';
import PositionsTable from '@/components/PaperTrading/PositionsTable';
import TransactionHistory from '@/components/PaperTrading/TransactionHistory';
import AdvancedTradingTabs from '@/components/AdvancedTrading/AdvancedTradingTabs';
import PortfolioOptimizer from '@/components/AI/PortfolioOptimizer';
import PortfolioNews from '@/components/AI/PortfolioNews';
import PortfolioSelector from '@/components/Portfolio/PortfolioSelector';

import ExportButton from '@/components/Data/ExportButton';

import ImportTrades from '@/components/Data/ImportTrades';

export default async function PortfolioPage(props: { searchParams: Promise<{ portfolioId?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/sign-in');
  }

  const userId = session.user.id;
  const portfolioId = searchParams.portfolioId;

  const [portfolio, portfolios, transactions] = await Promise.all([
    getPortfolio(userId, portfolioId),
    getPortfolios(userId),
    getTransactionHistory(userId, 100)
  ]);

  if (!portfolio) {
    return (
      <div className="container py-10">
        <h1 className="text-3xl font-bold text-gray-100 mb-6">Portfolio</h1>
        <p className="text-gray-400">Error loading portfolio. Please try again later.</p>
      </div>
    );
  }

  // Prepare data for export
  const exportData = portfolio.positions.map((pos: any) => ({
    Symbol: pos.symbol,
    Quantity: pos.quantity,
    'Avg Price': pos.averagePrice,
    'Current Price': pos.currentPrice,
    'Market Value': pos.marketValue,
    'Return $': pos.totalReturn,
    'Return %': pos.totalReturnPercentage,
  }));

  return (
    <div className="w-full py-10 px-4 md:px-6 lg:px-8">
      <div className="max-w-screen-2xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-100">Paper Trading Portfolio</h1>
          <div className="flex items-center gap-4">
            <ImportTrades userId={userId} portfolioId={portfolio._id} />
            <ExportButton data={exportData} filename={`portfolio_${portfolio.name}`} />
            <PortfolioSelector
              userId={userId}
              portfolios={portfolios}
              currentPortfolioId={portfolio._id}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <PortfolioNews positions={portfolio.positions} className="h-fit" />
          <PortfolioOptimizer positions={portfolio.positions} />
        </div>

        <PortfolioSummary portfolio={portfolio} />

        <div className="grid grid-cols-1 gap-6 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-4">Positions</h2>
            <PositionsTable positions={portfolio.positions} />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-4">Advanced Trading</h2>
            <AdvancedTradingTabs
              userId={userId}
              portfolioId={portfolio._id}
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

