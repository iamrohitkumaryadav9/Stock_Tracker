'use client';

import TradingViewWidget from '@/components/TradingViewWidget';

export default function AdvancedChartsPage() {
    const config = {
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

    return (
        <div className="w-full h-[calc(100vh-64px)] bg-[#0B0E14] p-4">
            <TradingViewWidget
                title="Advanced Charts"
                scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
                config={config}
                height={800}
                className="h-full"
            />
        </div>
    );
}
