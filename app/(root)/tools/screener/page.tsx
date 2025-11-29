'use client';

import TradingViewWidget from '@/components/TradingViewWidget';

export default function ScreenerPage() {
    const config = {
        "width": "100%",
        "height": "100%",
        "defaultColumn": "overview",
        "defaultScreen": "general",
        "market": "america",
        "showToolbar": true,
        "colorTheme": "dark",
        "locale": "en"
    };

    return (
        <div className="w-full h-[calc(100vh-64px)] bg-[#0B0E14] p-4">
            <TradingViewWidget
                title="Stock Screener"
                scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-screener.js"
                config={config}
                height={800}
                className="h-full"
            />
        </div>
    );
}
