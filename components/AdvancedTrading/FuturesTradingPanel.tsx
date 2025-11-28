'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { executeFuturesTrade } from '@/lib/actions/advanced-trading.actions';
import { getFuturesQuote } from '@/lib/actions/market-data.actions';
import { toast } from 'sonner';
import { BarChart3, Loader2 } from 'lucide-react';

interface FuturesTradingPanelProps {
  userId: string;
  symbol?: string;
  onTradeComplete?: () => void;
}

export default function FuturesTradingPanel({ userId, symbol = '', onTradeComplete }: FuturesTradingPanelProps) {
  const [tradeSymbol, setTradeSymbol] = useState(symbol || 'ES');
  const [contractMonth, setContractMonth] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [loading, setLoading] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [quote, setQuote] = useState<{ price: number; contractSize: number } | null>(null);

  // Set default contract month to next month
  const defaultMonth = new Date();
  defaultMonth.setMonth(defaultMonth.getMonth() + 1);
  const defaultMonthStr = defaultMonth.toISOString().slice(0, 7);

  const handleFetchPrice = async () => {
    if (!tradeSymbol.trim()) {
      toast.error('Please enter a futures symbol');
      return;
    }

    setFetchingPrice(true);
    try {
      const futuresQuote = await getFuturesQuote(tradeSymbol, contractMonth || defaultMonthStr);
      if (futuresQuote) {
        setQuote({ price: futuresQuote.price, contractSize: futuresQuote.contractSize });
        toast.success(`${tradeSymbol} price: $${futuresQuote.price.toFixed(2)}`);
      } else {
        toast.error('Unable to fetch futures quote');
      }
    } catch (error) {
      toast.error('Error fetching futures quote');
    } finally {
      setFetchingPrice(false);
    }
  };

  const handleTrade = async () => {
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (!quote) {
      toast.error('Please fetch the current price first');
      return;
    }

    if (!tradeSymbol.trim()) {
      toast.error('Please enter a futures symbol');
      return;
    }

    setLoading(true);
    try {
      const result = await executeFuturesTrade({
        userId,
        symbol: tradeSymbol,
        contractMonth: contractMonth || defaultMonthStr,
        quantity: qty,
        type: tradeType
      });

      if (result.success) {
        toast.success(result.message);
        setQuantity('');
        setQuote(null);
        onTradeComplete?.();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to execute futures trade');
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = quote && quantity ? parseInt(quantity) * quote.price * quote.contractSize : 0;

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-yellow-500" />
        <h3 className="text-xl font-bold text-gray-100">Futures Trading</h3>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-gray-400 mb-2 block">Futures Symbol</Label>
          <Input
            value={tradeSymbol}
            onChange={(e) => setTradeSymbol(e.target.value.toUpperCase())}
            placeholder="e.g., ES (E-mini S&P 500), NQ (E-mini NASDAQ)"
            className="bg-gray-700 border-gray-600 text-white"
          />
          <p className="text-xs text-gray-500 mt-1">Common: ES, NQ, YM, CL, GC</p>
        </div>

        <div>
          <Label className="text-gray-400 mb-2 block">Contract Month</Label>
          <Input
            type="month"
            value={contractMonth || defaultMonthStr}
            onChange={(e) => setContractMonth(e.target.value)}
            min={new Date().toISOString().slice(0, 7)}
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

        {quote && (
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Current Price:</span>
              <span className="text-yellow-400 font-bold">${quote.price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mt-1 text-xs text-gray-500">
              <span>Contract Size:</span>
              <span>{quote.contractSize} units</span>
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
          <Label className="text-gray-400 mb-2 block">Quantity (Contracts)</Label>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Number of contracts"
            className="bg-gray-700 border-gray-600 text-white"
          />
        </div>

        {totalAmount > 0 && (
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Total Cost:</span>
              <span className="text-gray-100 font-bold">${totalAmount.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">(Price × Contracts × Contract Size)</p>
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
            `${tradeType === 'buy' ? 'Buy' : 'Sell'} Futures`
          )}
        </Button>
      </div>
    </div>
  );
}

