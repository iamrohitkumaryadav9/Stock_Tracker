import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface Post extends Document {
  userId: string;
  userName: string;
  userEmail: string;
  content: string;
  symbol?: string;
  type: 'insight' | 'trade' | 'question' | 'news';
  likes: string[]; // Array of user IDs who liked
  comments: Array<{
    userId: string;
    userName: string;
    content: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<Post>(
  {
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    content: { type: String, required: true, maxlength: 1000 },
    symbol: { type: String, uppercase: true, index: true },
    type: { type: String, required: true, enum: ['insight', 'trade', 'question', 'news'], default: 'insight' },
    likes: [{ type: String }],
    comments: [{
      userId: { type: String, required: true },
      userName: { type: String, required: true },
      content: { type: String, required: true, maxlength: 500 },
      timestamp: { type: Date, default: Date.now }
    }]
  },
  { timestamps: true }
);

// Indexes for efficient queries
PostSchema.index({ symbol: 1, createdAt: -1 });
PostSchema.index({ userId: 1, createdAt: -1 });
PostSchema.index({ type: 1, createdAt: -1 });

export const Post: Model<Post> =
  (models?.Post as Model<Post>) || model<Post>('Post', PostSchema);

