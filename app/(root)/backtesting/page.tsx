import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getBacktests } from '@/lib/actions/backtest.actions';
import BacktestForm from '@/components/Backtesting/BacktestForm';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Calendar, DollarSign } from 'lucide-react';

export default async function BacktestingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/sign-in');
  }

  const backtests = await getBacktests(session.user.id);

  return (
    <div className="w-full py-10 px-4 md:px-6 lg:px-8">
      <div className="max-w-screen-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-100 mb-6">Strategy Backtesting</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">Your Backtests</h2>
            {backtests.length === 0 ? (
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-8 text-center">
                <p className="text-gray-400">No backtests yet. Create one to get started!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {backtests.map((backtest) => {
                  const isPositive = backtest.totalReturn >= 0;
                  return (
                    <Link
                      key={backtest.id}
                      href={`/backtesting/${backtest.id}`}
                      className="block bg-gray-800 border border-gray-600 rounded-lg p-4 hover:border-yellow-500 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-100">{backtest.name}</h3>
                          <p className="text-gray-400 text-sm font-mono">{backtest.symbol}</p>
                        </div>
                        <div className={`text-right ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                          <div className="flex items-center gap-1">
                            {isPositive ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                            <span className="font-bold">
                              {isPositive ? '+' : ''}{backtest.totalReturnPercent.toFixed(2)}%
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">
                            ${backtest.totalReturn.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(backtest.startDate).toLocaleDateString()} - {new Date(backtest.endDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          <span>
                            ${backtest.initialCapital.toLocaleString()} → ${backtest.finalValue.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          
          <div>
            <BacktestForm />
          </div>
        </div>
      </div>
    </div>
  );
}

