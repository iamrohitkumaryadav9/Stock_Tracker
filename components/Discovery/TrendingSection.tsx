'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import Link from 'next/link';

interface TrendingSectionProps {
    trending: any[];
}

export default function TrendingSection({ trending }: TrendingSectionProps) {
    return (
        <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
                <CardTitle className="text-gray-100 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-yellow-500" />
                    Trending Now
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {trending.map((stock: any) => (
                        <Link
                            key={stock.symbol}
                            href={`/stocks/${stock.symbol}`}
                            className="block p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-all hover:scale-105"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-lg text-gray-100">{stock.symbol}</span>
                                {stock.change >= 0 ? (
                                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                                ) : (
                                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                                )}
                            </div>
                            <div className="text-sm text-gray-400 truncate" title={stock.name}>{stock.name}</div>
                            {stock.price && (
                                <div className="mt-2 font-mono text-gray-200">${stock.price.toFixed(2)}</div>
                            )}
                        </Link>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
