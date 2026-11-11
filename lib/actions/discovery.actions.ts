'use server';

import { connectToDatabase } from '@/database/mongoose';
import { User } from '@/database/models/user.model';
import { Post } from '@/database/models/post.model';
import { Portfolio } from '@/database/models/portfolio.model';
import { Position } from '@/database/models/position.model';
import { Watchlist } from '@/database/models/watchlist.model';
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

// ==================== SEARCH ====================

export interface SearchResults {
    stocks: { symbol: string; name: string; type?: string; exchange?: string }[];
    users: { id: string; name: string; image?: string }[];
    posts: { id: string; userName: string; content: string; symbol?: string; type: string; createdAt: string }[];
    /** Per-source failures, so one broken source never blanks the others and the UI can say what failed. */
    errors: { stocks?: string; users?: string; posts?: string };
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function searchGlobal(rawQuery: string, type: 'all' | 'stocks' | 'users' | 'posts' = 'all'): Promise<SearchResults> {
    const results: SearchResults = { stocks: [], users: [], posts: [], errors: {} };
    const query = (rawQuery ?? '').trim().slice(0, 80);
    if (!query) return results;
    // User input must never be interpreted as a regex (invalid patterns throw, and some are ReDoS vectors).
    const rx = new RegExp(escapeRegex(query), 'i');
    const want = (t: string) => type === 'all' || type === t;

    // Each source is independent: a failure in one must not hide results from the others.
    await Promise.all([
        // 1. Stocks (Yahoo Finance)
        (async () => {
            if (!want('stocks')) return;
            try {
                const res = await yahooFinance.search(query);
                results.stocks = (res.quotes ?? [])
                    .filter((q: any) => q.isYahooFinance && q.symbol)
                    .slice(0, 8)
                    .map((q: any) => ({
                        symbol: q.symbol,
                        name: q.shortname || q.longname || q.symbol,
                        type: q.quoteType,
                        exchange: q.exchDisp || q.exchange,
                    }));
            } catch (error) {
                console.error('Yahoo search error:', error);
                results.errors.stocks = 'Stock search is temporarily unavailable.';
            }
        })(),

        // 2. People: accounts live in better-auth's `user` collection (the old Clerk-style `User` model is unused).
        //    Only the public display name and avatar are returned. Never the email.
        (async () => {
            if (!want('users')) return;
            try {
                const mongoose = await connectToDatabase();
                const rows = await mongoose.connection.db!
                    .collection('user')
                    .find({ name: rx }, { projection: { name: 1, image: 1 } })
                    .limit(8)
                    .toArray();
                results.users = rows.map((u) => ({ id: String(u._id), name: String(u.name ?? 'Unknown'), image: u.image ?? undefined }));
            } catch (error) {
                console.error('User search error:', error);
                results.errors.users = 'People search is temporarily unavailable.';
            }
        })(),

        // 3. Community posts (fields are `content` and `userName`; an exact ticker match also counts)
        (async () => {
            if (!want('posts')) return;
            try {
                await connectToDatabase();
                const rows = await Post.find({ $or: [{ content: rx }, { symbol: query.toUpperCase() }] })
                    .sort({ createdAt: -1 })
                    .limit(8)
                    .lean();
                results.posts = rows.map((p) => ({
                    id: String(p._id),
                    userName: p.userName,
                    content: p.content,
                    symbol: p.symbol,
                    type: p.type,
                    createdAt: new Date(p.createdAt).toISOString(),
                }));
            } catch (error) {
                console.error('Post search error:', error);
                results.errors.posts = 'Post search is temporarily unavailable.';
            }
        })(),
    ]);

    return results;
}

// ==================== TRENDING ====================

export async function getTrendingStocks() {
    try {
        // 1. Market Trending (Yahoo Finance)
        const queryOptions = { count: 5, lang: 'en-US' };
        const result = await yahooFinance.trendingSymbols('US', queryOptions);

        const trending = result.quotes.map((q: any) => ({
            symbol: q.symbol,
            name: q.shortname || q.longname, // Yahoo trending result structure might vary, adjusting safely
            price: q.regularMarketPrice,
            change: q.regularMarketChangePercent,
            source: 'Market'
        }));

        return trending;
    } catch (error) {
        console.error('Trending stocks error:', error);
        // Fallback mock data
        return [
            { symbol: 'NVDA', name: 'NVIDIA Corp', price: 800.00, change: 2.5, source: 'Market' },
            { symbol: 'AAPL', name: 'Apple Inc', price: 175.00, change: 0.5, source: 'Market' },
            { symbol: 'TSLA', name: 'Tesla Inc', price: 180.00, change: -1.2, source: 'Market' },
            { symbol: 'AMD', name: 'Advanced Micro Devices', price: 160.00, change: 3.1, source: 'Market' },
            { symbol: 'MSFT', name: 'Microsoft Corp', price: 410.00, change: 1.1, source: 'Market' }
        ];
    }
}

// ==================== AI RECOMMENDATIONS ====================

export async function getAiRecommendations(userId: string) {
    try {
        await connectToDatabase();

        // Fetch user context: Portfolio holdings and Watchlist
        const portfolios = await Portfolio.find({ userId });
        const portfolioIds = portfolios.map(p => p._id);
        const positions = await Position.find({ portfolioId: { $in: portfolioIds } }).select('symbol assetType');
        const watchlist = await Watchlist.findOne({ userId }).select('stocks');

        const holdings = positions.map(p => p.symbol).join(', ');
        const watching = watchlist?.stocks?.join(', ') || '';

        if (!holdings && !watching) {
            return {
                recommendations: [],
                reasoning: "Add stocks to your portfolio or watchlist to get personalized recommendations."
            };
        }

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `
      As a financial analyst AI, suggest 3 stock recommendations based on the user's current interest.
      
      User Holdings: ${holdings || 'None'}
      User Watchlist: ${watching || 'None'}
      
      Provide the response in strict JSON format with the following structure:
      {
        "recommendations": [
          {
            "symbol": "TICKER",
            "name": "Company Name",
            "reason": "Brief reason why this fits the user's profile (max 1 sentence)"
          }
        ],
        "overall_strategy": "Brief comment on their portfolio balance (max 1 sentence)"
      }
      Do not include markdown formatting like \`\`\`json. Just the raw JSON string.
    `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(text);

    } catch (error) {
        console.error('AI Recommendations error:', error);
        return {
            recommendations: [
                { symbol: 'SPY', name: 'S&P 500 ETF', reason: 'Diversified market exposure is recommended for all investors.' },
                { symbol: 'QQQ', name: 'Invesco QQQ', reason: 'Growth-focused ETF for tech exposure.' },
                { symbol: 'VTI', name: 'Vanguard Total Stock Market', reason: 'Total market coverage for stability.' }
            ],
            overall_strategy: "Unable to generate personalized insights at the moment. Showing general recommendations."
        };
    }
}

export async function getSimilarStocks(symbol: string) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `
      Suggest 3 stocks that are similar to ${symbol} (competitors or same sector).
      Provide response in strict JSON:
      [
        { "symbol": "TICKER", "name": "Company Name", "reason": "Why similar" }
      ]
      No markdown.
    `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(text);
    } catch (error) {
        console.error('Similar stocks error:', error);
        return [];
    }
}

export async function getWatchlistSuggestions(userId: string) {
    // Re-use AI recommendations logic but specifically for watchlist additions
    // For simplicity, we can alias getAiRecommendations or customize the prompt slightly
    return getAiRecommendations(userId);
}
