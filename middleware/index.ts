import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
    const sessionCookie = getSessionCookie(request);

    // Create response
    let response: NextResponse;
    
    if (!sessionCookie) {
        response = NextResponse.redirect(new URL("/", request.url));
    } else {
        response = NextResponse.next();
    }

    // Add CSP headers to allow TradingView widgets
    const cspHeader = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s3.tradingview.com https://www.tradingview.com https://www.tradingview-widget.com https://*.tradingview.com",
        "style-src 'self' 'unsafe-inline' https://s3.tradingview.com https://www.tradingview.com https://www.tradingview-widget.com https://*.tradingview.com",
        "frame-src 'self' https://www.tradingview-widget.com https://s.tradingview.com https://www.tradingview.com https://*.tradingview.com",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data: https:",
        "connect-src 'self' https://s3.tradingview.com https://www.tradingview.com https://www.tradingview-widget.com https://*.tradingview.com https://finnhub.io wss://*.tradingview.com ws://*.tradingview.com",
        "worker-src 'self' blob:",
        "child-src 'self' https://www.tradingview-widget.com https://*.tradingview.com",
    ].join('; ');

    response.headers.set('Content-Security-Policy', cspHeader);
    // Allow TradingView to load resources - use origin to send referrer
    // TradingView may require referrer header to allow script loading
    response.headers.set('Referrer-Policy', 'origin-when-cross-origin');

    return response;
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|sign-in|sign-up|assets).*)',
    ],
};
