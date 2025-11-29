'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Portfolio } from '@/database/models/portfolio.model';
import { User } from '@/database/models/user.model';

export interface LeaderboardEntry {
    userId: string;
    username: string;
    totalValue: number;
    totalReturn: number;
    totalReturnPercent: number;
    rank: number;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
        await connectToDatabase();

        // Fetch top 50 portfolios by total return percent
        // Note: In a real app, we would probably have a separate Leaderboard collection updated periodically
        // to avoid expensive aggregations on every request.
        const portfolios = await Portfolio.find()
            .sort({ totalValue: -1 }) // Sort by total value for now, or we could calculate return
            .limit(50)
            .lean();

        // Fetch user details for these portfolios
        const userIds = portfolios.map(p => p.userId);
        const users = await User.find({ clerkId: { $in: userIds } }).lean();
        const userMap = new Map(users.map(u => [u.clerkId, u]));

        const leaderboard: LeaderboardEntry[] = portfolios.map((portfolio, index) => {
            const user = userMap.get(portfolio.userId);
            const initialValue = 100000; // Assuming everyone starts with 100k
            const totalReturn = portfolio.totalValue - initialValue;
            const totalReturnPercent = (totalReturn / initialValue) * 100;

            return {
                userId: portfolio.userId,
                username: user?.username || 'Anonymous Trader',
                totalValue: portfolio.totalValue,
                totalReturn,
                totalReturnPercent,
                rank: index + 1
            };
        });

        // Sort by return percent
        return leaderboard.sort((a, b) => b.totalReturnPercent - a.totalReturnPercent);

    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return [];
    }
}
