'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface AiRecommendationsProps {
    data: {
        recommendations: any[];
        overall_strategy: string;
    };
}

export default function AiRecommendations({ data }: AiRecommendationsProps) {
    return (
        <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-gray-100 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-400" />
                        AI Recommendations
                    </CardTitle>
                    <Badge variant="outline" className="border-purple-500 text-purple-400">Gemini Powered</Badge>
                </div>
                <CardDescription className="text-gray-400">
                    {data.overall_strategy}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {data.recommendations.map((rec: any, index: number) => (
                        <div key={index} className="flex gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
                            <div className="flex-shrink-0">
                                <div className="h-10 w-10 rounded-full bg-purple-900/30 flex items-center justify-center">
                                    <Lightbulb className="h-5 w-5 text-purple-400" />
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <Link href={`/stocks/${rec.symbol}`} className="font-bold text-gray-100 hover:text-purple-400 transition-colors">
                                        {rec.symbol}
                                    </Link>
                                    <span className="text-xs text-gray-500">{rec.name}</span>
                                </div>
                                <p className="text-sm text-gray-300">{rec.reason}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
