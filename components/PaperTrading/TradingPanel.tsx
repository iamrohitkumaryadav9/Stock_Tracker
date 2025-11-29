'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { executeTrade, getPortfolio } from '@/lib/actions/portfolio.actions';
import { getStockQuote } from '@/lib/actions/quote.actions';
import { toast } from 'sonner';
import RealTimeStockPrice from '../RealTimeStockPrice';
import { useRouter } from 'next/navigation';

interface TradingPanelProps {
  symbol: string;
  userId: string;
}

export default function TradingPanel({ symbol = '', userId }: TradingPanelProps) {
  const [tradeSymbol, setTradeSymbol] = useState<string>(symbol);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState<string>('');
  const [price, setPrice] = useState<number | null>(null);
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop'>('market');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [stopPrice, setStopPrice] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const router = useRouter();

  const handleFetchPrice = async () => {
    if (!tradeSymbol.trim()) {
      toast.error('Please enter a stock symbol');
      return;
    }
    setFetchingPrice(true);
    try {
      const quote = await getStockQuote(tradeSymbol);
      if (quote) {
        setPrice(quote.price);
        toast.success(`Current price: $${quote.price.toFixed(2)}`);
      } else {
        toast.error('Unable to fetch current price');
      }
    } catch (error) {
      toast.error('Error fetching price');
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

    if (!price || price <= 0) {
      toast.error('Please fetch the current price first');
      return;
    }

    if (!tradeSymbol.trim()) {
      toast.error('Please enter a stock symbol');
      return;
    }

    setLoading(true);
    try {
      const result = await executeTrade(
        userId,
        tradeSymbol,
        tradeType,
        qty,
        price,
        orderType,
        limitPrice ? parseFloat(limitPrice) : undefined,
        stopPrice ? parseFloat(stopPrice) : undefined
      );

      if (result.success) {
        toast.success(result.message);
        setQuantity('');
        setPrice(null);

        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to execute trade');
    } finally {
      setLoading(false);
    }
  };

  const totalCost = price && quantity ? (parseFloat(quantity) * price).toFixed(2) : '0.00';

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-6">
      <h3 className="text-xl font-bold text-gray-100 mb-4">Paper Trading</h3>

      <div className="space-y-4">
        <div>
          <Label htmlFor="symbol" className="text-gray-400 mb-2 block">Stock Symbol</Label>
          <div className="flex items-center gap-2">
            <Input
              id="symbol"
              type="text"
              value={tradeSymbol}
              onChange={(e) => setTradeSymbol(e.target.value.toUpperCase())}
              placeholder="Enter symbol (e.g., AAPL)"
              className="bg-gray-700 border-gray-600 text-white font-mono"
            />
            {tradeSymbol && (
              <RealTimeStockPrice
                symbol={tradeSymbol}
                initialPrice={price || undefined}
                showIndicator={true}
              />
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant={tradeType === 'buy' ? 'default' : 'outline'}
            onClick={() => setTradeType('buy')}
            className={tradeType === 'buy' ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            Buy
          </Button>
          <Button
            variant={tradeType === 'sell' ? 'default' : 'outline'}
            onClick={() => setTradeType('sell')}
            className={tradeType === 'sell' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            Sell
          </Button>
        </div>

        <div>
          <Label className="text-gray-400 mb-2 block">Order Type</Label>
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as any)}
            className="w-full bg-gray-700 border border-gray-600 text-white rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            <option value="market">Market Order</option>
            <option value="limit">Limit Order</option>
            <option value="stop">Stop Order</option>
            <option value="stop_limit">Stop Limit Order</option>
            <option value="trailing_stop">Trailing Stop</option>
          </select>
        </div>

        {(orderType === 'limit' || orderType === 'stop_limit') && (
          <div>
            <Label className="text-gray-400 mb-2 block">Limit Price</Label>
            <Input
              type="number"
              step="0.01"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder="Enter limit price"
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
        )}

        {(orderType === 'stop' || orderType === 'stop_limit' || orderType === 'trailing_stop') && (
          <div>
            <Label className="text-gray-400 mb-2 block">
              {orderType === 'trailing_stop' ? 'Trailing Amount ($)' : 'Stop Price'}
            </Label>
            <Input
              type="number"
              step="0.01"
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value)}
              placeholder={orderType === 'trailing_stop' ? "e.g., 5.00" : "Enter stop price"}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
        )}

        <div>
          <Label htmlFor="quantity" className="text-gray-400 mb-2 block">
            Quantity
          </Label>
          <Input
            id="quantity"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Enter quantity"
            className="bg-gray-700 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label htmlFor="price" className="text-gray-400 mb-2 block">
            Price per Share
          </Label>
          <div className="flex gap-2">
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={price || ''}
              onChange={(e) => setPrice(parseFloat(e.target.value) || null)}
              placeholder="0.00"
              className="bg-gray-700 border-gray-600 text-white"
            />
            <Button
              variant="outline"
              onClick={handleFetchPrice}
              disabled={fetchingPrice}
              className="whitespace-nowrap"
            >
              {fetchingPrice ? 'Fetching...' : 'Get Current Price'}
            </Button>
          </div>
        </div>

        {price && quantity && (
          <div className="bg-gray-700 p-3 rounded">
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span>Total {tradeType === 'buy' ? 'Cost' : 'Proceeds'}:</span>
              <span className="text-lg font-bold text-gray-100">${totalCost}</span>
            </div>
          </div>
        )}

        <Button
          onClick={handleTrade}
          disabled={loading || !quantity || !price}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold"
        >
          {loading ? 'Processing...' : `${tradeType === 'buy' ? 'Buy' : 'Sell'} ${quantity || 0} Shares`}
        </Button>
      </div>
    </div>
  );
}

