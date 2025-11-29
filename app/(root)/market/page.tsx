'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TradingViewWidget from '@/components/TradingViewWidget';
import { BarChart2, Filter, Grid } from 'lucide-react';

export default function MarketPage() {
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
        <div className="w-full min-h-[calc(100vh-64px)] bg-[#0B0E14] p-4 md:p-6">
            <div className="max-w-[1920px] mx-auto h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-gray-100">Market Analysis</h1>
                </div>

                <Tabs defaultValue="charts" className="flex-1 flex flex-col">
                    <TabsList className="bg-gray-800 border-gray-700 w-fit mb-4">
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
                    </TabsList>

                    <div className="flex-1 min-h-[85vh] bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden relative">
                        <TabsContent value="charts" className="h-full m-0 p-0 absolute inset-0">
                            <TradingViewWidget
                                title="Advanced Charts"
                                scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
                                config={chartsConfig}
                                height="100%"
                                className="h-full w-full"
                            />
                        </TabsContent>

                        <TabsContent value="screener" className="h-full m-0 p-0 absolute inset-0">
                            <TradingViewWidget
                                title="Stock Screener"
                                scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-screener.js"
                                config={screenerConfig}
                                height="100%"
                                className="h-full w-full"
                            />
                        </TabsContent>

                        <TabsContent value="heatmap" className="h-full m-0 p-0 absolute inset-0">
                            <TradingViewWidget
                                title="Stock Heatmap"
                                scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js"
                                config={heatmapConfig}
                                height="100%"
                                className="h-full w-full"
                            />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    );
}
