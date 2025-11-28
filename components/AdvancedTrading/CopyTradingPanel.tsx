'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  followTrader, 
  unfollowTrader, 
  getCopyTradingList 
} from '@/lib/actions/advanced-trading.actions';
import { toast } from 'sonner';
import { Users, UserPlus, UserMinus, Loader2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyTradingPanelProps {
  userId: string;
}

export default function CopyTradingPanel({ userId }: CopyTradingPanelProps) {
  const [traderId, setTraderId] = useState<string>('');
  const [copyPercentage, setCopyPercentage] = useState<string>('100');
  const [maxPositionSize, setMaxPositionSize] = useState<string>('');
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<('stock' | 'crypto' | 'forex' | 'futures' | 'options')[]>(['stock']);
  const [loading, setLoading] = useState(false);
  const [copyList, setCopyList] = useState<Array<{
    traderId: string;
    traderName?: string;
    copyPercentage: number;
    isActive: boolean;
    assetTypes: string[];
  }>>([]);
  const [loadingList, setLoadingList] = useState(false);

  const assetTypeOptions: Array<{ value: 'stock' | 'crypto' | 'forex' | 'futures' | 'options'; label: string }> = [
    { value: 'stock', label: 'Stocks' },
    { value: 'crypto', label: 'Crypto' },
    { value: 'forex', label: 'Forex' },
    { value: 'futures', label: 'Futures' },
    { value: 'options', label: 'Options' }
  ];

  useEffect(() => {
    loadCopyList();
  }, []);

  const loadCopyList = async () => {
    setLoadingList(true);
    try {
      const list = await getCopyTradingList(userId);
      setCopyList(list);
    } catch (error) {
      console.error('Error loading copy list:', error);
    } finally {
      setLoadingList(false);
    }
  };

  const handleFollow = async () => {
    if (!traderId.trim()) {
      toast.error('Please enter a trader ID');
      return;
    }

    const percentage = parseFloat(copyPercentage);
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      toast.error('Copy percentage must be between 0 and 100');
      return;
    }

    const maxSize = maxPositionSize ? parseFloat(maxPositionSize) : undefined;
    if (maxSize !== undefined && (isNaN(maxSize) || maxSize <= 0)) {
      toast.error('Max position size must be a positive number');
      return;
    }

    setLoading(true);
    try {
      const result = await followTrader(
        userId,
        traderId.trim(),
        percentage,
        maxSize,
        selectedAssetTypes
      );

      if (result.success) {
        toast.success(result.message);
        setTraderId('');
        setCopyPercentage('100');
        setMaxPositionSize('');
        setSelectedAssetTypes(['stock']);
        loadCopyList();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to follow trader');
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (traderIdToUnfollow: string) => {
    setLoading(true);
    try {
      const result = await unfollowTrader(userId, traderIdToUnfollow);
      if (result.success) {
        toast.success(result.message);
        loadCopyList();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to unfollow trader');
    } finally {
      setLoading(false);
    }
  };

  const toggleAssetType = (assetType: 'stock' | 'crypto' | 'forex' | 'futures' | 'options') => {
    setSelectedAssetTypes(prev =>
      prev.includes(assetType)
        ? prev.filter(t => t !== assetType)
        : [...prev, assetType]
    );
  };

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-yellow-500" />
        <h3 className="text-xl font-bold text-gray-100">Copy Trading</h3>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-gray-400 mb-2 block">Trader ID to Follow</Label>
          <Input
            value={traderId}
            onChange={(e) => setTraderId(e.target.value)}
            placeholder="Enter trader's user ID"
            className="bg-gray-700 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label className="text-gray-400 mb-2 block">Copy Percentage</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={copyPercentage}
            onChange={(e) => setCopyPercentage(e.target.value)}
            placeholder="100"
            className="bg-gray-700 border-gray-600 text-white"
          />
          <p className="text-xs text-gray-500 mt-1">Percentage of trader's position size to copy (0-100%)</p>
        </div>

        <div>
          <Label className="text-gray-400 mb-2 block">Max Position Size (Optional)</Label>
          <Input
            type="number"
            min="0"
            value={maxPositionSize}
            onChange={(e) => setMaxPositionSize(e.target.value)}
            placeholder="e.g., 10000"
            className="bg-gray-700 border-gray-600 text-white"
          />
          <p className="text-xs text-gray-500 mt-1">Maximum dollar amount per copied position</p>
        </div>

        <div>
          <Label className="text-gray-400 mb-2 block">Asset Types to Copy</Label>
          <div className="flex flex-wrap gap-2">
            {assetTypeOptions.map((option) => (
              <Button
                key={option.value}
                variant={selectedAssetTypes.includes(option.value) ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleAssetType(option.value)}
                className={cn(
                  selectedAssetTypes.includes(option.value)
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900'
                    : ''
                )}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleFollow}
          disabled={loading || !traderId.trim()}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4 mr-2" />
              Follow Trader
            </>
          )}
        </Button>

        <div className="border-t border-gray-600 pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-semibold text-gray-100">Following</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadCopyList}
              disabled={loadingList}
              className="text-gray-400 hover:text-gray-200"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>

          {loadingList ? (
            <div className="text-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500 mx-auto" />
            </div>
          ) : copyList.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">Not following any traders</p>
          ) : (
            <div className="space-y-2">
              {copyList.map((item) => (
                <div
                  key={item.traderId}
                  className="bg-gray-700 p-3 rounded-lg flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-100 font-semibold">
                        {item.traderName || `Trader ${item.traderId.slice(0, 8)}`}
                      </span>
                      {item.isActive ? (
                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                          Active
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Copy {item.copyPercentage}% • {item.assetTypes.join(', ')}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnfollow(item.traderId)}
                    disabled={loading}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

