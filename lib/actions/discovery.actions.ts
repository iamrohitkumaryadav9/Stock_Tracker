'use server';

import { connectToDatabase } from '@/database/mongoose';
import { User } from '@/database/models/user.model';
import { Post } from '@/database/models/post.model';
import { Portfolio } from '@/database/models/portfolio.model';
import { Position } from '@/database/models/position.model';
import { Watchlist } from '@/database/models/watchlist.model';
import yahooFinance from 'yahoo-finance2';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

// ==================== SEARCH ====================

export async function searchGlobal(query: string, type: 'all' | 'stocks' | 'users' | 'posts' = 'all') {
    try {
        await connectToDatabase();
        const results: any = {
            stocks: [],
            users: [],
            posts: []
        };

        // 1. Search Stocks (Yahoo Finance)
        if (type === 'all' || type === 'stocks') {
            try {
                const yahooResults = await yahooFinance.search(query);
                results.stocks = yahooResults.quotes
                    .filter((q: any) => q.isYahooFinance) // Filter valid quotes
                    .slice(0, 5)
                    .map((q: any) => ({
                        symbol: q.symbol,
                        name: q.shortname || q.longname,
                        type: q.quoteType,
                        exchange: q.exchange
                    }));
            } catch (error) {
                console.error('Yahoo search error:', error);
            }
        }

        // 2. Search Users (DB)
        if (type === 'all' || type === 'users') {
            const users = await User.find({
                $or: [
                    { name: { $regex: query, $options: 'i' } },
                    { username: { $regex: query, $options: 'i' } }
                ]
            }).limit(5).select('_id name username photo');

            results.users = JSON.parse(JSON.stringify(users));
        }

        // 3. Search Posts (DB)
        if (type === 'all' || type === 'posts') {
            const posts = await Post.find({
                text: { $regex: query, $options: 'i' }
            })
                .populate('author', '_id name username photo')
                .sort({ createdAt: -1 })
                .limit(5);

            results.posts = JSON.parse(JSON.stringify(posts));
        }

        return results;
    } catch (error) {
        console.error('Global search error:', error);
        return { stocks: [], users: [], posts: [] };
    }
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
