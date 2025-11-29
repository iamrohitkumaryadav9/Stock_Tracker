'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { executeOptionsTrade } from '@/lib/actions/advanced-trading.actions';
import { getOptionQuote } from '@/lib/actions/market-data.actions';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Loader2, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface OptionsTradingPanelProps {
  userId: string;
  underlyingSymbol?: string;
  underlyingSymbol?: string;
}

export default function OptionsTradingPanel({ userId, underlyingSymbol = '' }: OptionsTradingPanelProps) {
  const [symbol, setSymbol] = useState(underlyingSymbol);
  const [strikePrice, setStrikePrice] = useState<string>('');
  const [expirationDate, setExpirationDate] = useState<string>('');
  const [optionType, setOptionType] = useState<'call' | 'put'>('call');
  const [quantity, setQuantity] = useState<string>('');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [loading, setLoading] = useState(false);
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const [optionQuote, setOptionQuote] = useState<{ price: number; bid?: number; ask?: number } | null>(null);
  const router = useRouter();

  const handleFetchQuote = async () => {
    if (!symbol.trim() || !strikePrice || !expirationDate) {
      toast.error('Please enter underlying symbol, strike price, and expiration date');
      return;
    }

    const strike = parseFloat(strikePrice);
    if (isNaN(strike) || strike <= 0) {
      toast.error('Please enter a valid strike price');
      return;
    }

    setFetchingQuote(true);
    try {
      const quote = await getOptionQuote(symbol, strike, expirationDate, optionType);
      if (quote) {
        setOptionQuote({ price: quote.price, bid: quote.bid, ask: quote.ask });
        toast.success(`Option premium: $${quote.price.toFixed(2)}`);
      } else {
        toast.error('Unable to fetch option quote');
      }
    } catch (error) {
      toast.error('Error fetching option quote');
    } finally {
      setFetchingQuote(false);
    }
  };

  const handleTrade = async () => {
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (!optionQuote) {
      toast.error('Please fetch the option quote first');
      return;
    }

    if (!symbol.trim() || !strikePrice || !expirationDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    const strike = parseFloat(strikePrice);
    if (isNaN(strike) || strike <= 0) {
      toast.error('Please enter a valid strike price');
      return;
    }

    setLoading(true);
    try {
      const result = await executeOptionsTrade({
        userId,
        underlyingSymbol: symbol,
        strikePrice: strike,
        expirationDate,
        optionType,
        quantity: qty,
        type: tradeType
      });

      if (result.success) {
        toast.success(result.message);
        setQuantity('');
        setOptionQuote(null);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to execute options trade');
    } finally {
      setLoading(false);
    }
  };

  const totalCost = optionQuote && quantity ? parseFloat(quantity) * optionQuote.price * 100 : 0;

  // Set default expiration to 30 days from now
  const defaultExpiration = new Date();
  defaultExpiration.setDate(defaultExpiration.getDate() + 30);
  const defaultExpirationStr = defaultExpiration.toISOString().split('T')[0];

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5 text-yellow-500" />
        <h3 className="text-xl font-bold text-gray-100">Options Trading</h3>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-gray-400 mb-2 block">Underlying Symbol</Label>
          <Input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="e.g., AAPL"
            className="bg-gray-700 border-gray-600 text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-400 mb-2 block">Strike Price</Label>
            <Input
              type="number"
              value={strikePrice}
              onChange={(e) => setStrikePrice(e.target.value)}
              placeholder="e.g., 150"
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>

          <div>
            <Label className="text-gray-400 mb-2 block">Expiration Date</Label>
            <Input
              type="date"
              value={expirationDate || defaultExpirationStr}
              onChange={(e) => setExpirationDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
        </div>

        <div>
          <Label className="text-gray-400 mb-2 block">Option Type</Label>
          <div className="flex gap-2">
            <Button
              variant={optionType === 'call' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setOptionType('call')}
              className={cn(
                optionType === 'call' ? 'bg-green-500 hover:bg-green-600 text-white' : ''
              )}
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              Call
            </Button>
            <Button
              variant={optionType === 'put' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setOptionType('put')}
              className={cn(
                optionType === 'put' ? 'bg-red-500 hover:bg-red-600 text-white' : ''
              )}
            >
              <TrendingDown className="h-4 w-4 mr-1" />
              Put
            </Button>
          </div>
        </div>

        <Button
          onClick={handleFetchQuote}
          disabled={fetchingQuote || !symbol.trim() || !strikePrice || !expirationDate}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white"
        >
          {fetchingQuote ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Fetching...
            </>
          ) : (
            'Fetch Option Quote'
          )}
        </Button>

        {optionQuote && (
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Premium:</span>
              <span className="text-yellow-400 font-bold">${optionQuote.price.toFixed(2)}</span>
            </div>
            {optionQuote.bid && optionQuote.ask && (
              <div className="flex justify-between items-center mt-1 text-xs text-gray-500">
                <span>Bid: ${optionQuote.bid.toFixed(2)}</span>
                <span>Ask: ${optionQuote.ask.toFixed(2)}</span>
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
              className={cn(
                tradeType === 'buy' ? 'bg-green-500 hover:bg-green-600 text-white' : ''
              )}
            >
              Buy
            </Button>
            <Button
              variant={tradeType === 'sell' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTradeType('sell')}
              className={cn(
                tradeType === 'sell' ? 'bg-red-500 hover:bg-red-600 text-white' : ''
              )}
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

        {totalCost > 0 && (
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Total Cost:</span>
              <span className="text-gray-100 font-bold">${totalCost.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">(Premium × Contracts × 100)</p>
          </div>
        )}

        <Button
          onClick={handleTrade}
          disabled={loading || !quantity || !optionQuote}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Executing...
            </>
          ) : (
            `${tradeType === 'buy' ? 'Buy' : 'Sell'} Options`
          )}
        </Button>
      </div>
    </div>
  );
}

