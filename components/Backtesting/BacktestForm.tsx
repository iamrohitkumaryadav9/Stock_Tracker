'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBacktest } from '@/lib/actions/backtest.actions';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface BacktestFormProps {
  onBacktestComplete?: () => void;
}

export default function BacktestForm({ onBacktestComplete }: BacktestFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    startDate: '',
    endDate: '',
    initialCapital: '10000',
    strategyType: 'buy_and_hold' as 'buy_and_hold' | 'moving_average' | 'rsi',
    maShortPeriod: '10',
    maLongPeriod: '30',
    rsiPeriod: '14',
    rsiOversold: '30',
    rsiOverbought: '70'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.symbol || !formData.startDate || !formData.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);

    if (startDate >= endDate) {
      toast.error('End date must be after start date');
      return;
    }

    if (startDate > new Date()) {
      toast.error('Start date cannot be in the future');
      return;
    }

    setLoading(true);
    try {
      let parameters: Record<string, any> = {};
      
      if (formData.strategyType === 'moving_average') {
        parameters = {
          shortPeriod: parseInt(formData.maShortPeriod),
          longPeriod: parseInt(formData.maLongPeriod)
        };
      } else if (formData.strategyType === 'rsi') {
        parameters = {
          period: parseInt(formData.rsiPeriod),
          oversold: parseInt(formData.rsiOversold),
          overbought: parseInt(formData.rsiOverbought)
        };
      }

      const result = await createBacktest(
        formData.name,
        formData.symbol.toUpperCase(),
        startDate,
        endDate,
        {
          type: formData.strategyType,
          parameters
        },
        parseFloat(formData.initialCapital)
      );

      if (result.success) {
        toast.success('Backtest completed successfully!');
        setFormData({
          name: '',
          symbol: '',
          startDate: '',
          endDate: '',
          initialCapital: '10000',
          strategyType: 'buy_and_hold',
          maShortPeriod: '10',
          maLongPeriod: '30',
          rsiPeriod: '14',
          rsiOversold: '30',
          rsiOverbought: '70'
        });
        onBacktestComplete?.();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to run backtest');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 border border-gray-600 rounded-lg p-6 space-y-4">
      <h3 className="text-xl font-bold text-gray-100 mb-4">Create Backtest</h3>

      <div>
        <Label htmlFor="name" className="text-gray-400 mb-2 block">Backtest Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="My Strategy Test"
          className="bg-gray-700 border-gray-600 text-white"
          required
        />
      </div>

      <div>
        <Label htmlFor="symbol" className="text-gray-400 mb-2 block">Stock Symbol</Label>
        <Input
          id="symbol"
          value={formData.symbol}
          onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
          placeholder="AAPL"
          className="bg-gray-700 border-gray-600 text-white font-mono"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate" className="text-gray-400 mb-2 block">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            className="bg-gray-700 border-gray-600 text-white"
            required
          />
        </div>
        <div>
          <Label htmlFor="endDate" className="text-gray-400 mb-2 block">End Date</Label>
          <Input
            id="endDate"
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            className="bg-gray-700 border-gray-600 text-white"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="initialCapital" className="text-gray-400 mb-2 block">Initial Capital ($)</Label>
        <Input
          id="initialCapital"
          type="number"
          min="1000"
          step="1000"
          value={formData.initialCapital}
          onChange={(e) => setFormData({ ...formData, initialCapital: e.target.value })}
          className="bg-gray-700 border-gray-600 text-white"
          required
        />
      </div>

      <div>
        <Label htmlFor="strategyType" className="text-gray-400 mb-2 block">Strategy</Label>
        <select
          id="strategyType"
          value={formData.strategyType}
          onChange={(e) => setFormData({ ...formData, strategyType: e.target.value as any })}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
        >
          <option value="buy_and_hold">Buy and Hold</option>
          <option value="moving_average">Moving Average Crossover</option>
          <option value="rsi">RSI Strategy</option>
        </select>
      </div>

      {formData.strategyType === 'moving_average' && (
        <div className="grid grid-cols-2 gap-4 bg-gray-700/50 p-4 rounded">
          <div>
            <Label htmlFor="maShortPeriod" className="text-gray-400 mb-2 block">Short MA Period</Label>
            <Input
              id="maShortPeriod"
              type="number"
              min="2"
              value={formData.maShortPeriod}
              onChange={(e) => setFormData({ ...formData, maShortPeriod: e.target.value })}
              className="bg-gray-600 border-gray-500 text-white"
            />
          </div>
          <div>
            <Label htmlFor="maLongPeriod" className="text-gray-400 mb-2 block">Long MA Period</Label>
            <Input
              id="maLongPeriod"
              type="number"
              min="2"
              value={formData.maLongPeriod}
              onChange={(e) => setFormData({ ...formData, maLongPeriod: e.target.value })}
              className="bg-gray-600 border-gray-500 text-white"
            />
          </div>
        </div>
      )}

      {formData.strategyType === 'rsi' && (
        <div className="grid grid-cols-3 gap-4 bg-gray-700/50 p-4 rounded">
          <div>
            <Label htmlFor="rsiPeriod" className="text-gray-400 mb-2 block">RSI Period</Label>
            <Input
              id="rsiPeriod"
              type="number"
              min="2"
              value={formData.rsiPeriod}
              onChange={(e) => setFormData({ ...formData, rsiPeriod: e.target.value })}
              className="bg-gray-600 border-gray-500 text-white"
            />
          </div>
          <div>
            <Label htmlFor="rsiOversold" className="text-gray-400 mb-2 block">Oversold Level</Label>
            <Input
              id="rsiOversold"
              type="number"
              min="0"
              max="50"
              value={formData.rsiOversold}
              onChange={(e) => setFormData({ ...formData, rsiOversold: e.target.value })}
              className="bg-gray-600 border-gray-500 text-white"
            />
          </div>
          <div>
            <Label htmlFor="rsiOverbought" className="text-gray-400 mb-2 block">Overbought Level</Label>
            <Input
              id="rsiOverbought"
              type="number"
              min="50"
              max="100"
              value={formData.rsiOverbought}
              onChange={(e) => setFormData({ ...formData, rsiOverbought: e.target.value })}
              className="bg-gray-600 border-gray-500 text-white"
            />
          </div>
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Running Backtest...
          </>
        ) : (
          'Run Backtest'
        )}
      </Button>
    </form>
  );
}

