'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TradingViewWidget from '@/components/TradingViewWidget';
import { BarChart2, Filter, Grid, LayoutDashboard, History, TrendingUp, TrendingDown, Calendar, DollarSign } from 'lucide-react';
import TrendingSection from '@/components/Discovery/TrendingSection';
import AiRecommendations from '@/components/Discovery/AiRecommendations';
import BacktestForm from '@/components/Backtesting/BacktestForm';
import Link from 'next/link';

interface DiscoveryTabsProps {
    trending: any[];
    recommendations: any;
    backtests: any[];
}

export default function DiscoveryTabs({ trending, recommendations, backtests }: DiscoveryTabsProps) {
    const chartsConfig = {
        "autosize": true,
        "symbol": "NASDAQ:AAPL",
        "interval": "D",
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "enable_publishing": false,
        "withdateranges": true,
        "hide_side_toolbar": false,
        "allow_symbol_change": true,
        "details": true,
        "hotlist": true,
        "calendar": true,
        "support_host": "https://www.tradingview.com"
    };

    const screenerConfig = {
        "width": "100%",
        "height": "100%",
        "defaultColumn": "overview",
        "defaultScreen": "general",
        "market": "america",
        "showToolbar": true,
        "colorTheme": "dark",
        "locale": "en"
    };

    const heatmapConfig = {
        "exchanges": [],
        "dataSource": "SPX500",
        "grouping": "sector",
        "blockSize": "market_cap_basic",
        "blockColor": "change",
        "locale": "en",
        "symbolUrl": "",
        "colorTheme": "dark",
        "hasTopBar": true,
        "isDataSetEnabled": true,
        "isZoomEnabled": true,
        "hasSymbolTooltip": true,
        "width": "100%",
        "height": "100%"
    };

    return (
        <Tabs defaultValue="overview" className="w-full h-full flex flex-col">
            <TabsList className="bg-gray-800 border-gray-700 w-full md:w-fit mb-6 grid grid-cols-2 md:flex flex-wrap h-auto gap-2">
                <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    <LayoutDashboard className="h-4 w-4" />
                    Overview
                </TabsTrigger>
                <TabsTrigger value="charts" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    <BarChart2 className="h-4 w-4" />
                    Advanced Charts
                </TabsTrigger>
                <TabsTrigger value="screener" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    <Filter className="h-4 w-4" />
                    Stock Screener
                </TabsTrigger>
                <TabsTrigger value="heatmap" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    <Grid className="h-4 w-4" />
                    Market Heatmap
                </TabsTrigger>
                <TabsTrigger value="backtesting" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    <History className="h-4 w-4" />
                    Backtesting
                </TabsTrigger>
            </TabsList>

            <div className="flex-1 min-h-[85vh] relative">
                <TabsContent value="overview" className="m-0 p-0 absolute inset-0 overflow-y-auto">
                    <div className="space-y-8 pb-10">
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
                </TabsContent>

                <TabsContent value="charts" className="h-full m-0 p-0 absolute inset-0 bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
                    <TradingViewWidget
                        title="Advanced Charts"
                        scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
                        config={chartsConfig}
                        height="100%"
                        className="h-full w-full"
                    />
                </TabsContent>

                <TabsContent value="screener" className="h-full m-0 p-0 absolute inset-0 bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
                    <TradingViewWidget
                        title="Stock Screener"
                        scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-screener.js"
                        config={screenerConfig}
                        height="100%"
                        className="h-full w-full"
                    />
                </TabsContent>

                <TabsContent value="heatmap" className="h-full m-0 p-0 absolute inset-0 bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
                    <TradingViewWidget
                        title="Stock Heatmap"
                        scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js"
                        config={heatmapConfig}
                        height="100%"
                        className="h-full w-full"
                    />
                </TabsContent>

                <TabsContent value="backtesting" className="m-0 p-0 absolute inset-0 overflow-y-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-10">
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
                </TabsContent>
            </div>
        </Tabs>
    );
}
