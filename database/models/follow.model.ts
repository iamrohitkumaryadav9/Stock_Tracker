import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface Follow extends Document {
  followerId: string; // User who is following
  followingId: string; // User being followed
  createdAt: Date;
}

const FollowSchema = new Schema<Follow>(
  {
    followerId: { type: String, required: true, index: true },
    followingId: { type: String, required: true, index: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

// Prevent duplicate follows
FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

export const Follow: Model<Follow> =
  (models?.Follow as Model<Follow>) || model<Follow>('Follow', FollowSchema);

