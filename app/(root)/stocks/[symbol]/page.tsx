import TradingViewWidget from "@/components/TradingViewWidget";
import WatchlistButton from "@/components/WatchlistButton";
import RealTimeStockPrice from "@/components/RealTimeStockPrice";
import AIPricePrediction from "@/components/AIPricePrediction";
import PostFeed from "@/components/Social/PostFeed";
import CreatePost from "@/components/Social/CreatePost";
import SentimentAnalysis from "@/components/AI/SentimentAnalysis";
import PatternRecognition from "@/components/AI/PatternRecognition";
import RiskAssessment from "@/components/AI/RiskAssessment";
import TradingSignals from "@/components/AI/TradingSignals";
import { getStockQuote } from "@/lib/actions/quote.actions";
import { getPosts } from "@/lib/actions/social.actions";
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import {
  SYMBOL_INFO_WIDGET_CONFIG,
  CANDLE_CHART_WIDGET_CONFIG,
  BASELINE_WIDGET_CONFIG,
  TECHNICAL_ANALYSIS_WIDGET_CONFIG,
  COMPANY_PROFILE_WIDGET_CONFIG,
  COMPANY_FINANCIALS_WIDGET_CONFIG,
} from "@/lib/constants";

export default async function StockDetails({ params }: StockDetailsPageProps) {
  const { symbol } = await params;
  const scriptUrl = `https://s3.tradingview.com/external-embedding/embed-widget-`;
  
  // Get current user session
  const session = await auth.api.getSession({ headers: await headers() });
  const currentUserId = session?.user?.id;
  
  // Fetch initial quote for the stock
  const initialQuote = await getStockQuote(symbol);
  
  // Fetch social posts for this symbol
  const socialPosts = await getPosts(symbol, 10);

  return (
    <div className="flex min-h-screen p-4 md:p-6 lg:p-8">
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        {/* Left column */}
        <div className="flex flex-col gap-6">
          <TradingViewWidget
            scriptUrl={`${scriptUrl}symbol-info.js`}
            config={SYMBOL_INFO_WIDGET_CONFIG(symbol)}
            height={170}
          />

          <TradingViewWidget
            scriptUrl={`${scriptUrl}advanced-chart.js`}
            config={CANDLE_CHART_WIDGET_CONFIG(symbol)}
            className="custom-chart"
            height={600}
          />

          <TradingViewWidget
            scriptUrl={`${scriptUrl}advanced-chart.js`}
            config={BASELINE_WIDGET_CONFIG(symbol)}
            className="custom-chart"
            height={600}
          />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-100 mb-2">{symbol.toUpperCase()}</h1>
                <RealTimeStockPrice
                  symbol={symbol}
                  initialPrice={initialQuote?.price}
                  initialChange={initialQuote?.change}
                  initialChangePercent={initialQuote?.changePercent}
                  className="text-2xl"
                  showIndicator={true}
                />
              </div>
            </div>
            <WatchlistButton symbol={symbol.toUpperCase()} company={symbol.toUpperCase()} isInWatchlist={false} />
          </div>

          <TradingViewWidget
            scriptUrl={`${scriptUrl}technical-analysis.js`}
            config={TECHNICAL_ANALYSIS_WIDGET_CONFIG(symbol)}
            height={400}
          />

          <TradingViewWidget
            scriptUrl={`${scriptUrl}company-profile.js`}
            config={COMPANY_PROFILE_WIDGET_CONFIG(symbol)}
            height={440}
          />

          <TradingViewWidget
            scriptUrl={`${scriptUrl}financials.js`}
            config={COMPANY_FINANCIALS_WIDGET_CONFIG(symbol)}
            height={464}
          />

          <AIPricePrediction
            symbol={symbol}
            currentPrice={initialQuote?.price || 0}
          />

          {/* AI Analysis Section */}
          <div className="mt-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">AI Analysis</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SentimentAnalysis symbol={symbol} />
              <PatternRecognition symbol={symbol} />
              <RiskAssessment symbol={symbol} />
              <TradingSignals symbol={symbol} />
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">Community Discussions</h2>
            <CreatePost symbol={symbol} />
            <div className="mt-4">
              <PostFeed symbol={symbol} initialPosts={socialPosts} currentUserId={currentUserId} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
