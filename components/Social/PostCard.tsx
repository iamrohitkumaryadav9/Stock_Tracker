'use client';

import { useState } from 'react';
import { Heart, MessageCircle, Share2, Trash2 } from 'lucide-react';
import { likePost, addComment, deletePost } from '@/lib/actions/social.actions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { SocialPost } from '@/lib/actions/social.actions';
import { cn } from '@/lib/utils';

interface PostCardProps {
  post: SocialPost;
  onUpdate?: () => void;
  currentUserId?: string;
}

export default function PostCard({ post, onUpdate, currentUserId }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likes);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingLike, setSubmittingLike] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  
  const isOwner = currentUserId && post.userId === currentUserId;

  const handleLike = async () => {
    setSubmittingLike(true);
    try {
      const result = await likePost(post.id);
      if (result.success) {
        setIsLiked(!isLiked);
        setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to like post');
    } finally {
      setSubmittingLike(false);
    }
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const result = await addComment(post.id, commentText);
      if (result.success) {
        toast.success('Comment added');
        setCommentText('');
        onUpdate?.();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deletePost(post.id);
      if (result.success) {
        toast.success('Post deleted successfully');
        setIsDeleted(true);
        // Call onUpdate to refresh the feed
        onUpdate?.();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  const typeColors = {
    insight: 'bg-blue-500/20 text-blue-400',
    trade: 'bg-green-500/20 text-green-400',
    question: 'bg-yellow-500/20 text-yellow-400',
    news: 'bg-purple-500/20 text-purple-400'
  };

  // Don't render if deleted
  if (isDeleted) {
    return null;
  }

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-yellow-500 flex items-center justify-center">
            <span className="text-gray-900 font-bold text-sm">
              {post.userName[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <div>
            <p className="text-gray-100 font-semibold">{post.userName}</p>
            <p className="text-gray-500 text-sm">
              {new Date(post.createdAt).toLocaleDateString()} • {new Date(post.createdAt).toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {post.symbol && (
            <Link
              href={`/stocks/${post.symbol}`}
              className="px-2 py-1 bg-gray-700 text-yellow-400 rounded text-sm font-mono hover:bg-gray-600 transition-colors"
            >
              {post.symbol}
            </Link>
          )}
          <span className={cn('px-2 py-1 rounded text-xs font-semibold', typeColors[post.type])}>
            {post.type}
          </span>
          {isOwner && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="ml-2 p-1.5 text-gray-400 hover:text-red-400 transition-colors rounded hover:bg-red-500/10"
              title="Delete post"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <p className="text-gray-300 mb-4 whitespace-pre-wrap">{post.content}</p>

      <div className="flex items-center gap-4 pt-3 border-t border-gray-600">
        <button
          onClick={handleLike}
          disabled={submittingLike}
          className={cn(
            'flex items-center gap-2 text-sm transition-colors',
            isLiked ? 'text-red-400' : 'text-gray-400 hover:text-red-400'
          )}
        >
          <Heart className={cn('h-4 w-4', isLiked && 'fill-current')} />
          <span>{likesCount}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-yellow-400 transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          <span>{post.comments.length}</span>
        </button>

        <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-yellow-400 transition-colors">
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      {showComments && (
        <div className="mt-4 pt-4 border-t border-gray-600">
          <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
            {post.comments.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No comments yet</p>
            ) : (
              post.comments.map((comment, index) => (
                <div key={index} className="bg-gray-700/50 rounded p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-100 font-semibold text-sm">{comment.userName}</span>
                    <span className="text-gray-500 text-xs">
                      {new Date(comment.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm">{comment.content}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="bg-gray-700 border-gray-600 text-white"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleComment();
                }
              }}
            />
            <Button
              onClick={handleComment}
              disabled={!commentText.trim() || submittingComment}
              className="bg-yellow-500 hover:bg-yellow-600 text-gray-900"
            >
              {submittingComment ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

