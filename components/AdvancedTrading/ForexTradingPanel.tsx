'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { executeForexTrade } from '@/lib/actions/advanced-trading.actions';
import { getForexQuote } from '@/lib/actions/market-data.actions';
import { toast } from 'sonner';
import { Globe, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ForexTradingPanelProps {
  userId: string;
  pair?: string;
  portfolioId?: string;
}

export default function ForexTradingPanel({ userId, pair = '', portfolioId }: ForexTradingPanelProps) {
  const [tradePair, setTradePair] = useState(pair || 'EUR/USD');
  const [quantity, setQuantity] = useState<string>('');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [loading, setLoading] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [quote, setQuote] = useState<{ rate: number; bid?: number; ask?: number } | null>(null);
  const router = useRouter();

  const handleFetchPrice = async () => {
    if (!tradePair.trim()) {
      toast.error('Please enter a forex pair');
      return;
    }

    if (!tradePair.includes('/')) {
      toast.error('Please use format: BASE/QUOTE (e.g., EUR/USD)');
      return;
    }

    setFetchingPrice(true);
    try {
      const forexQuote = await getForexQuote(tradePair);
      if (forexQuote) {
        setQuote({ rate: forexQuote.rate, bid: forexQuote.bid, ask: forexQuote.ask });
        toast.success(`${tradePair} rate: ${forexQuote.rate.toFixed(5)}`);
      } else {
        toast.error('Unable to fetch forex quote');
      }
    } catch (error) {
      toast.error('Error fetching forex quote');
    } finally {
      setFetchingPrice(false);
    }
  };

  const handleTrade = async () => {
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid lot size');
      return;
    }

    if (!quote) {
      toast.error('Please fetch the current rate first');
      return;
    }

    if (!tradePair.trim() || !tradePair.includes('/')) {
      toast.error('Please enter a valid forex pair (e.g., EUR/USD)');
      return;
    }

    setLoading(true);
    try {
      const result = await executeForexTrade({
        userId,
        pair: tradePair,
        quantity: qty,
        type: tradeType,
        portfolioId
      });

      if (result.success) {
        toast.success(result.message);
        setQuantity('');
        setQuote(null);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to execute forex trade');
    } finally {
      setLoading(false);
    }
  };

  const lotSize = 100000; // Standard lot size
  const totalAmount = quote && quantity ? parseFloat(quantity) * lotSize * quote.rate : 0;

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="h-5 w-5 text-yellow-500" />
        <h3 className="text-xl font-bold text-gray-100">Forex Trading</h3>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-gray-400 mb-2 block">Currency Pair</Label>
          <Input
            value={tradePair}
            onChange={(e) => setTradePair(e.target.value.toUpperCase())}
            placeholder="e.g., EUR/USD, GBP/USD"
            className="bg-gray-700 border-gray-600 text-white"
          />
          <p className="text-xs text-gray-500 mt-1">Format: BASE/QUOTE</p>
        </div>

        <Button
          onClick={handleFetchPrice}
          disabled={fetchingPrice || !tradePair.trim()}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white"
        >
          {fetchingPrice ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Fetching...
            </>
          ) : (
            'Fetch Current Rate'
          )}
        </Button>

        {quote && (
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Exchange Rate:</span>
              <span className="text-yellow-400 font-bold">{quote.rate.toFixed(5)}</span>
            </div>
            {quote.bid && quote.ask && (
              <div className="flex justify-between items-center mt-1 text-xs text-gray-500">
                <span>Bid: {quote.bid.toFixed(5)}</span>
                <span>Ask: {quote.ask.toFixed(5)}</span>
              </div>
            )}
          </div>
        )}

        <div>
          <Label className="text-gray-400 mb-2 block">Trade Type</Label>
          <div className="flex gap-2">
            <Button
              variant={tradeType === 'buy' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTradeType('buy')}
              className={tradeType === 'buy' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
            >
              Buy
            </Button>
            <Button
              variant={tradeType === 'sell' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTradeType('sell')}
              className={tradeType === 'sell' ? 'bg-red-500 hover:bg-red-600 text-white' : ''}
            >
              Sell
            </Button>
          </div>
        </div>

        <div>
          <Label className="text-gray-400 mb-2 block">Lot Size</Label>
          <Input
            type="number"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Number of lots (1 lot = 100,000 units)"
            className="bg-gray-700 border-gray-600 text-white"
          />
          <p className="text-xs text-gray-500 mt-1">1 lot = 100,000 units of base currency</p>
        </div>

        {totalAmount > 0 && (
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Total Amount:</span>
              <span className="text-gray-100 font-bold">${totalAmount.toFixed(2)}</span>
            </div>
          </div>
        )}

        <Button
          onClick={handleTrade}
          disabled={loading || !quantity || !quote}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Executing...
            </>
          ) : (
            `${tradeType === 'buy' ? 'Buy' : 'Sell'} Forex`
          )}
        </Button>
      </div>
    </div>
  );
}

