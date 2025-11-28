'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Post } from '@/database/models/post.model';
import { Follow } from '@/database/models/follow.model';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';

export interface SocialPost {
  id: string;
  userId: string;
  userName: string;
  content: string;
  symbol?: string;
  type: 'insight' | 'trade' | 'question' | 'news';
  likes: number;
  isLiked: boolean;
  comments: Array<{
    userId: string;
    userName: string;
    content: string;
    timestamp: Date;
  }>;
  createdAt: Date;
}

export async function createPost(
  content: string,
  symbol?: string,
  type: 'insight' | 'trade' | 'question' | 'news' = 'insight'
): Promise<{ success: boolean; message: string; postId?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return { success: false, message: 'Not authenticated' };
    }

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const post = await Post.create({
      userId: session.user.id,
      userName: session.user.name || 'Anonymous',
      userEmail: session.user.email || '',
      content: content.trim(),
      symbol: symbol?.toUpperCase(),
      type
    });

    return {
      success: true,
      message: 'Post created successfully',
      postId: post._id.toString()
    };
  } catch (error) {
    console.error('Error creating post:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create post'
    };
  }
}

export async function getPosts(
  symbol?: string,
  limit: number = 20
): Promise<SocialPost[]> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const currentUserId = session?.user?.id;

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const query: any = {};
    if (symbol) {
      query.symbol = symbol.toUpperCase();
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return posts.map(post => ({
      id: post._id.toString(),
      userId: post.userId,
      userName: post.userName,
      content: post.content,
      symbol: post.symbol,
      type: post.type,
      likes: post.likes.length,
      isLiked: currentUserId ? post.likes.includes(currentUserId) : false,
      comments: post.comments,
      createdAt: post.createdAt
    }));
  } catch (error) {
    console.error('Error getting posts:', error);
    return [];
  }
}

export async function likePost(postId: string): Promise<{ success: boolean; message: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return { success: false, message: 'Not authenticated' };
    }

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const post = await Post.findById(postId);
    if (!post) {
      return { success: false, message: 'Post not found' };
    }

    const userId = session.user.id;
    const isLiked = post.likes.includes(userId);

    if (isLiked) {
      post.likes = post.likes.filter(id => id !== userId);
    } else {
      post.likes.push(userId);
    }

    await post.save();

    return {
      success: true,
      message: isLiked ? 'Post unliked' : 'Post liked'
    };
  } catch (error) {
    console.error('Error liking post:', error);
    return {
      success: false,
      message: 'Failed to like post'
    };
  }
}

export async function addComment(
  postId: string,
  content: string
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return { success: false, message: 'Not authenticated' };
    }

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const post = await Post.findById(postId);
    if (!post) {
      return { success: false, message: 'Post not found' };
    }

    post.comments.push({
      userId: session.user.id,
      userName: session.user.name || 'Anonymous',
      content: content.trim(),
      timestamp: new Date()
    });

    await post.save();

    return {
      success: true,
      message: 'Comment added successfully'
    };
  } catch (error) {
    console.error('Error adding comment:', error);
    return {
      success: false,
      message: 'Failed to add comment'
    };
  }
}

export async function followUser(followingId: string): Promise<{ success: boolean; message: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return { success: false, message: 'Not authenticated' };
    }

    if (session.user.id === followingId) {
      return { success: false, message: 'Cannot follow yourself' };
    }

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const existingFollow = await Follow.findOne({
      followerId: session.user.id,
      followingId
    });

    if (existingFollow) {
      await Follow.deleteOne({ _id: existingFollow._id });
      return { success: true, message: 'Unfollowed user' };
    } else {
      await Follow.create({
        followerId: session.user.id,
        followingId
      });
      return { success: true, message: 'Following user' };
    }
  } catch (error) {
    console.error('Error following user:', error);
    return {
      success: false,
      message: 'Failed to follow user'
    };
  }
}

export async function getFollowing(userId: string): Promise<string[]> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const follows = await Follow.find({ followerId: userId }).lean();
    return follows.map(f => f.followingId);
  } catch (error) {
    console.error('Error getting following:', error);
    return [];
  }
}

export async function getFollowers(userId: string): Promise<string[]> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const follows = await Follow.find({ followingId: userId }).lean();
    return follows.map(f => f.followerId);
  } catch (error) {
    console.error('Error getting followers:', error);
    return [];
  }
}

export async function deletePost(postId: string): Promise<{ success: boolean; message: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return { success: false, message: 'Not authenticated' };
    }

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const post = await Post.findById(postId);
    if (!post) {
      return { success: false, message: 'Post not found' };
    }

    // Check if the user owns the post
    if (post.userId !== session.user.id) {
      return { success: false, message: 'You can only delete your own posts' };
    }

    // Delete the post
    await Post.deleteOne({ _id: postId });

    return {
      success: true,
      message: 'Post deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting post:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete post'
    };
  }
}

