'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { executeCryptoTrade } from '@/lib/actions/advanced-trading.actions';
import { getCryptoQuote } from '@/lib/actions/market-data.actions';
import { toast } from 'sonner';
import { Coins, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CryptoTradingPanelProps {
  userId: string;
  symbol?: string;
  portfolioId?: string;
}

export default function CryptoTradingPanel({ userId, symbol = '', portfolioId }: CryptoTradingPanelProps) {
  const [tradeSymbol, setTradeSymbol] = useState(symbol);
  const [quantity, setQuantity] = useState<string>('');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [loading, setLoading] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const router = useRouter();

  const handleFetchPrice = async () => {
    if (!tradeSymbol.trim()) {
      toast.error('Please enter a crypto symbol');
      return;
    }

    setFetchingPrice(true);
    try {
      const quote = await getCryptoQuote(tradeSymbol);
      if (quote) {
        setPrice(quote.price);
        toast.success(`${tradeSymbol.toUpperCase()} price: $${quote.price.toFixed(2)}`);
      } else {
        toast.error('Unable to fetch crypto price');
      }
    } catch (error) {
      toast.error('Error fetching crypto price');
    } finally {
      setFetchingPrice(false);
    }
  };

  const handleTrade = async () => {
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (!price || price <= 0) {
      toast.error('Please fetch the current price first');
      return;
    }

    if (!tradeSymbol.trim()) {
      toast.error('Please enter a crypto symbol');
      return;
    }

    setLoading(true);
    try {
      const result = await executeCryptoTrade({
        userId,
        symbol: tradeSymbol,
        quantity: qty,
        type: tradeType,
        portfolioId
      });

      if (result.success) {
        toast.success(result.message);
        setQuantity('');
        setPrice(null);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to execute crypto trade');
    } finally {
      setLoading(false);
    }
  };

  const totalCost = price && quantity ? parseFloat(quantity) * price : 0;

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Coins className="h-5 w-5 text-yellow-500" />
        <h3 className="text-xl font-bold text-gray-100">Crypto Trading</h3>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-gray-400 mb-2 block">Crypto Symbol</Label>
          <Input
            value={tradeSymbol}
            onChange={(e) => setTradeSymbol(e.target.value.toUpperCase())}
            placeholder="e.g., BTC, ETH, SOL"
            className="bg-gray-700 border-gray-600 text-white"
          />
        </div>

        <Button
          onClick={handleFetchPrice}
          disabled={fetchingPrice || !tradeSymbol.trim()}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white"
        >
          {fetchingPrice ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Fetching...
            </>
          ) : (
            'Fetch Current Price'
          )}
        </Button>

        {price && (
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Current Price:</span>
              <span className="text-yellow-400 font-bold">${price.toFixed(2)}</span>
            </div>
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
          <Label className="text-gray-400 mb-2 block">Quantity</Label>
          <Input
            type="number"
            step="0.00000001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Amount to trade"
            className="bg-gray-700 border-gray-600 text-white"
          />
        </div>

        {totalCost > 0 && (
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Total Cost:</span>
              <span className="text-gray-100 font-bold">${totalCost.toFixed(2)}</span>
            </div>
          </div>
        )}

        <Button
          onClick={handleTrade}
          disabled={loading || !quantity || !price}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Executing...
            </>
          ) : (
            `${tradeType === 'buy' ? 'Buy' : 'Sell'} Crypto`
          )}
        </Button>
      </div>
    </div>
  );
}

