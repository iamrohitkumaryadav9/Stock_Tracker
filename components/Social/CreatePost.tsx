'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createPost } from '@/lib/actions/social.actions';
import { toast } from 'sonner';
import { Send, Brain, TrendingUp, HelpCircle, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreatePostProps {
  symbol?: string;
  onPostCreated?: () => void;
}

export default function CreatePost({ symbol, onPostCreated }: CreatePostProps) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<'insight' | 'trade' | 'question' | 'news'>('insight');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error('Please enter some content');
      return;
    }

    if (content.length > 1000) {
      toast.error('Post content is too long (max 1000 characters)');
      return;
    }

    setLoading(true);
    try {
      const result = await createPost(content, symbol, postType);
      if (result.success) {
        toast.success('Post created successfully');
        setContent('');
        // Call the callback if provided (for Client Component usage)
        onPostCreated?.();
        // Refresh the page data to show the new post
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const typeOptions = [
    { value: 'insight' as const, label: 'Insight', icon: Brain },
    { value: 'trade' as const, label: 'Trade', icon: TrendingUp },
    { value: 'question' as const, label: 'Question', icon: HelpCircle },
    { value: 'news' as const, label: 'News', icon: Newspaper }
  ];

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">Create Post</h3>
      
      <div className="space-y-4">
        <div>
          <Label className="text-gray-400 mb-2 block">Post Type</Label>
          <div className="flex gap-2 flex-wrap">
            {typeOptions.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={postType === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPostType(value)}
                className={cn(
                  postType === value ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900' : ''
                )}
              >
                <Icon className="h-4 w-4 mr-1" />
                {label}
              </Button>
            ))}
          </div>
        </div>

        {symbol && (
          <div>
            <Label className="text-gray-400 mb-2 block">Stock Symbol</Label>
            <span className="px-3 py-2 bg-gray-700 text-yellow-400 rounded font-mono text-sm">
              {symbol}
            </span>
          </div>
        )}

        <div>
          <Label htmlFor="content" className="text-gray-400 mb-2 block">
            What's on your mind?
          </Label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your insights, trades, questions, or news..."
            className="w-full min-h-[100px] p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
            maxLength={1000}
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-500">
              {content.length}/1000 characters
            </span>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={loading || !content.trim()}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold"
        >
          {loading ? (
            'Posting...'
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Post
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

