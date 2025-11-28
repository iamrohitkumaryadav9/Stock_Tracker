'use client';

import { useEffect, useState } from 'react';
import { getPosts, SocialPost } from '@/lib/actions/social.actions';
import PostCard from './PostCard';
import { Loader2 } from 'lucide-react';

interface PostFeedProps {
  symbol?: string;
  initialPosts?: SocialPost[];
  currentUserId?: string;
}

export default function PostFeed({ symbol, initialPosts = [], currentUserId }: PostFeedProps) {
  const [posts, setPosts] = useState<SocialPost[]>(initialPosts);
  const [loading, setLoading] = useState(false);

  const refreshPosts = async () => {
    setLoading(true);
    try {
      const newPosts = await getPosts(symbol);
      setPosts(newPosts);
    } catch (error) {
      console.error('Error refreshing posts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPosts.length === 0) {
      refreshPosts();
    }
  }, [symbol]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-100">
          {symbol ? `Discussions about ${symbol}` : 'Community Feed'}
        </h2>
        <button
          onClick={refreshPosts}
          disabled={loading}
          className="text-sm text-yellow-500 hover:text-yellow-400 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
        </button>
      </div>

      {loading && posts.length === 0 ? (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500 mx-auto" />
          <p className="text-gray-400 mt-2">Loading posts...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-8 text-center">
          <p className="text-gray-400">No posts yet. Be the first to share your insights!</p>
        </div>
      ) : (
        posts.map(post => (
          <PostCard key={post.id} post={post} onUpdate={refreshPosts} currentUserId={currentUserId} />
        ))
      )}
    </div>
  );
}

