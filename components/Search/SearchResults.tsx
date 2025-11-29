'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { TrendingUp, User as UserIcon, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchResultsProps {
    results: {
        stocks: any[];
        users: any[];
        posts: any[];
    };
    type: string;
}

export default function SearchResults({ results, type }: SearchResultsProps) {
    const showStocks = type === 'all' || type === 'stocks';
    const showUsers = type === 'all' || type === 'users';
    const showPosts = type === 'all' || type === 'posts';

    return (
        <div className="space-y-6">
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
                        {results.stocks.map((stock: any) => (
                            <Link key={stock.symbol} href={`/stocks/${stock.symbol}`} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors">
                                <div>
                                    <div className="font-bold text-gray-100">{stock.symbol}</div>
                                    <div className="text-sm text-gray-400">{stock.name}</div>
                                </div>
                                <div className="text-xs text-gray-500">{stock.exchange}</div>
                            </Link>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Users */}
            {showUsers && results.users.length > 0 && (
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                        <CardTitle className="text-gray-100 flex items-center gap-2">
                            <UserIcon className="h-5 w-5 text-green-500" />
                            People
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {results.users.map((user: any) => (
                            <Link key={user._id} href={`/profile/${user._id}`} className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={user.photo} />
                                    <AvatarFallback>{user.name[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="font-medium text-gray-100">{user.name}</div>
                                    <div className="text-sm text-gray-400">@{user.username}</div>
                                </div>
                            </Link>
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
                        {results.posts.map((post: any) => (
                            <div key={post._id} className="p-4 bg-gray-700/50 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <Avatar className="h-6 w-6">
                                        <AvatarImage src={post.author?.photo} />
                                        <AvatarFallback>{post.author?.name?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium text-gray-200">{post.author?.name}</span>
                                    <span className="text-xs text-gray-500">@{post.author?.username}</span>
                                </div>
                                <p className="text-gray-300 text-sm line-clamp-2">{post.text}</p>
                                <div className="mt-2">
                                    <Link href={`/posts/${post._id}`}>
                                        <Button variant="link" size="sm" className="text-blue-400 p-0 h-auto">View Post</Button>
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Empty State */}
            {!results.stocks.length && !results.users.length && !results.posts.length && (
                <div className="text-center py-10 text-gray-500">
                    No results found. Try a different search term.
                </div>
            )}
        </div>
    );
}
