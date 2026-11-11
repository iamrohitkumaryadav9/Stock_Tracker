'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { TrendingUp, User as UserIcon, MessageSquare } from 'lucide-react';
import type { SearchResults as Results } from '@/lib/actions/discovery.actions';

interface SearchResultsProps {
    results: Results;
    type: string;
    query: string;
}

export default function SearchResults({ results, type, query }: SearchResultsProps) {
    const showStocks = type === 'all' || type === 'stocks';
    const showUsers = type === 'all' || type === 'users';
    const showPosts = type === 'all' || type === 'posts';

    const errors = Object.entries(results.errors ?? {}).filter(([k]) => (k === 'stocks' ? showStocks : k === 'users' ? showUsers : showPosts));
    // Empty state looks only at the sections currently being shown, so a hidden tab can never mask "no results".
    const shown = (showStocks ? results.stocks.length : 0) + (showUsers ? results.users.length : 0) + (showPosts ? results.posts.length : 0);

    return (
        <div className="space-y-6">
            {errors.map(([k, msg]) => (
                <div key={k} role="alert" className="rounded-lg border border-yellow-800 bg-yellow-950/30 px-4 py-3 text-sm text-yellow-200">{msg as string}</div>
            ))}

            {/* Stocks */}
            {showStocks && results.stocks.length > 0 && (
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                        <CardTitle className="text-gray-100 flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-500" />
                            Stocks
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {results.stocks.map((stock) => (
                            <Link key={stock.symbol} href={`/stocks/${encodeURIComponent(stock.symbol)}`} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors">
                                <div>
                                    <div className="font-bold text-gray-100">{stock.symbol}</div>
                                    <div className="text-sm text-gray-400">{stock.name}</div>
                                </div>
                                <div className="text-xs text-gray-500">{[stock.type, stock.exchange].filter(Boolean).join(' · ')}</div>
                            </Link>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* People (no profile pages exist yet, so these are informational and intentionally not links) */}
            {showUsers && results.users.length > 0 && (
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                        <CardTitle className="text-gray-100 flex items-center gap-2">
                            <UserIcon className="h-5 w-5 text-green-500" />
                            People
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {results.users.map((user) => (
                            <div key={user.id} className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={user.image} />
                                    <AvatarFallback>{user.name?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                                </Avatar>
                                <div className="font-medium text-gray-100">{user.name}</div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Posts */}
            {showPosts && results.posts.length > 0 && (
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                        <CardTitle className="text-gray-100 flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-purple-500" />
                            Posts
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {results.posts.map((post) => (
                            <div key={post.id} className="p-4 bg-gray-700/50 rounded-lg">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <Avatar className="h-6 w-6">
                                        <AvatarFallback>{post.userName?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium text-gray-200">{post.userName}</span>
                                    {post.symbol && <Link href={`/stocks/${encodeURIComponent(post.symbol)}`} className="rounded bg-gray-600 px-1.5 py-0.5 text-xs text-yellow-300 hover:bg-gray-500">${post.symbol}</Link>}
                                    <span className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
                                </div>
                                <p className="text-gray-300 text-sm line-clamp-3">{post.content}</p>
                                <Link href="/social" className="mt-2 inline-block text-sm text-blue-400 hover:underline">Open community feed</Link>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Empty State */}
            {shown === 0 && errors.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                    No results for &ldquo;{query}&rdquo;{type !== 'all' ? ` in ${type}` : ''}. Try a different search term{type !== 'all' ? ' or the "All" tab' : ''}.
                </div>
            )}
        </div>
    );
}
