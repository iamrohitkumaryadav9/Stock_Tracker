'use client';

import { useEffect, useState } from 'react';
import { getLeaderboard, LeaderboardEntry } from '@/lib/actions/competition.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Leaderboard() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const data = await getLeaderboard();
                setLeaderboard(data);
            } catch (error) {
                console.error('Failed to load leaderboard', error);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {leaderboard.slice(0, 3).map((entry, index) => (
                    <Card
                        key={entry.userId}
                        className={cn(
                            "border-gray-700 bg-gray-800/50 relative overflow-hidden",
                            index === 0 ? "border-yellow-500/50 bg-yellow-500/10" :
                                index === 1 ? "border-gray-400/50 bg-gray-400/10" :
                                    "border-orange-700/50 bg-orange-700/10"
                        )}
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Trophy className="h-24 w-24" />
                        </div>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className={cn(
                                    "flex items-center justify-center w-8 h-8 rounded-full font-bold text-lg",
                                    index === 0 ? "bg-yellow-500 text-black" :
                                        index === 1 ? "bg-gray-400 text-black" :
                                            "bg-orange-700 text-white"
                                )}>
                                    {index + 1}
                                </div>
                                {index === 0 && <Trophy className="h-6 w-6 text-yellow-500" />}
                            </div>
                            <CardTitle className="text-xl mt-2">{entry.username}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-1">
                                <div className="text-3xl font-bold text-gray-100">
                                    {entry.totalReturnPercent.toFixed(2)}%
                                </div>
                                <div className="text-sm text-gray-400">Total Return</div>
                                <div className="text-sm font-mono text-gray-300 mt-2">
                                    ${entry.totalValue.toLocaleString()}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="bg-[#1E222D] border-[#2A2E39]">
                <CardHeader>
                    <CardTitle>Top Traders</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-400 uppercase bg-gray-800/50">
                                <tr>
                                    <th className="px-6 py-3 rounded-l-lg">Rank</th>
                                    <th className="px-6 py-3">Trader</th>
                                    <th className="px-6 py-3">Portfolio Value</th>
                                    <th className="px-6 py-3">Total Return</th>
                                    <th className="px-6 py-3 rounded-r-lg">Performance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map((entry, index) => (
                                    <tr key={entry.userId} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-300">
                                            {index < 3 ? (
                                                <Medal className={cn(
                                                    "h-5 w-5",
                                                    index === 0 ? "text-yellow-500" :
                                                        index === 1 ? "text-gray-400" :
                                                            "text-orange-700"
                                                )} />
                                            ) : (
                                                `#${index + 1}`
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-100">
                                            {entry.username}
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">
                                            ${entry.totalValue.toLocaleString()}
                                        </td>
                                        <td className={cn(
                                            "px-6 py-4 font-medium",
                                            entry.totalReturn >= 0 ? "text-green-500" : "text-red-500"
                                        )}>
                                            {entry.totalReturn >= 0 ? '+' : ''}{entry.totalReturn.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={cn(
                                                "flex items-center gap-1 font-bold",
                                                entry.totalReturnPercent >= 0 ? "text-green-500" : "text-red-500"
                                            )}>
                                                {entry.totalReturnPercent >= 0 ? (
                                                    <TrendingUp className="h-4 w-4" />
                                                ) : (
                                                    <TrendingDown className="h-4 w-4" />
                                                )}
                                                {Math.abs(entry.totalReturnPercent).toFixed(2)}%
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
