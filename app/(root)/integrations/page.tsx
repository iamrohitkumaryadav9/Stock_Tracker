import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import PlaidConnect from '@/components/Integrations/PlaidConnect';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default async function IntegrationsPage() {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
        redirect('/sign-in');
    }

    return (
        <div className="w-full py-10 px-4 md:px-6 lg:px-8">
            <div className="max-w-screen-xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-100 mb-2">Integrations</h1>
                <p className="text-gray-400 mb-8">Manage your external connections and API keys.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Plaid Integration */}
                    <PlaidConnect />

                    {/* Broker Integrations (Placeholder for Direct API) */}
                    <Card className="bg-gray-800 border-gray-700">
                        <CardHeader>
                            <CardTitle className="text-gray-100">Broker Connections</CardTitle>
                            <CardDescription className="text-gray-400">
                                Connect directly to your brokerage account.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                                <span className="text-gray-200 font-medium">Robinhood</span>
                                <Button variant="outline" size="sm" disabled>Coming Soon</Button>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                                <span className="text-gray-200 font-medium">TD Ameritrade</span>
                                <Button variant="outline" size="sm" disabled>Coming Soon</Button>
                            </div>
                            <p className="text-xs text-gray-500">
                                For now, please use the "Import Trades" feature in your Portfolio to upload CSVs from these brokers.
                            </p>
                        </CardContent>
                    </Card>

                    {/* API Keys */}
                    <Card className="bg-gray-800 border-gray-700 md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-gray-100">API Configuration</CardTitle>
                            <CardDescription className="text-gray-400">
                                Enter your personal API keys for enhanced data.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="alpha_vantage" className="text-gray-200">Alpha Vantage API Key</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="alpha_vantage"
                                        placeholder="Enter your key"
                                        className="bg-gray-700 border-gray-600 text-white"
                                        type="password"
                                    />
                                    <Button>Save</Button>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Used for additional technical indicators and forex/crypto data.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
