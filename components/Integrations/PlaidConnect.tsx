'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { usePlaidLink } from 'react-plaid-link';
import { Loader2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function PlaidConnect() {
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // In a real implementation, you would fetch a link token from your backend
    // useEffect(() => {
    //   const createLinkToken = async () => {
    //     const response = await fetch('/api/create_link_token', { method: 'POST' });
    //     const { link_token } = await response.json();
    //     setToken(link_token);
    //   };
    //   createLinkToken();
    // }, []);

    const onSuccess = (public_token: string, metadata: any) => {
        // Send public_token to backend to exchange for access_token
        console.log('Plaid Link Success:', public_token, metadata);
        toast.success('Successfully connected bank account (Simulation)');
    };

    const config: Parameters<typeof usePlaidLink>[0] = {
        token: token,
        onSuccess,
    };

    const { open, ready } = usePlaidLink(config);

    const handleConnect = () => {
        if (!token) {
            toast.info('Plaid integration requires a valid Link Token from the backend. This is a UI demo.');
            // For demo purposes, we can simulate a connection or show a modal
            return;
        }
        open();
    };

    return (
        <div className="p-6 bg-gray-800 rounded-lg border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-900/30 rounded-full">
                    <LinkIcon className="h-6 w-6 text-green-500" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-100">Connect Bank Account</h3>
                    <p className="text-sm text-gray-400">Link your bank account via Plaid for real trading.</p>
                </div>
            </div>

            <Button
                onClick={handleConnect}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
                Connect with Plaid
            </Button>

            <p className="text-xs text-gray-500 mt-3">
                Note: Requires Plaid Client ID and Secret in environment variables.
            </p>
        </div>
    );
}
