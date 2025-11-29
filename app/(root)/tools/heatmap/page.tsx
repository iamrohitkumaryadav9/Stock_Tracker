'use client';

import TradingViewWidget from '@/components/TradingViewWidget';

export default function HeatmapPage() {
    const config = {
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
        <div className="w-full h-[calc(100vh-64px)] bg-[#0B0E14] p-4">
            <TradingViewWidget
                title="Stock Heatmap"
                scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js"
                config={config}
                height={800}
                className="h-full"
            />
        </div>
    );
}
