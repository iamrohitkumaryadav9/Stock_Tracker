import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface CopyTrade extends Document {
  followerId: string; // User who is copying
  traderId: string; // User being copied
  isActive: boolean;
  copyPercentage: number; // Percentage of trader's position to copy (0-100)
  maxPositionSize?: number; // Maximum position size in dollars
  assetTypes: ('stock' | 'crypto' | 'forex' | 'futures' | 'options')[]; // Which asset types to copy
  createdAt: Date;
  updatedAt: Date;
}

const CopyTradeSchema = new Schema<CopyTrade>(
  {
    followerId: { type: String, required: true, index: true },
    traderId: { type: String, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    copyPercentage: { type: Number, required: true, min: 0, max: 100, default: 100 },
    maxPositionSize: { type: Number, min: 0 },
    assetTypes: [{ 
      type: String, 
      enum: ['stock', 'crypto', 'forex', 'futures', 'options'],
      default: ['stock']
    }]
  },
  { timestamps: true }
);

// Prevent duplicate copy relationships
CopyTradeSchema.index({ followerId: 1, traderId: 1 }, { unique: true });

// Indexes for efficient queries
CopyTradeSchema.index({ followerId: 1, isActive: 1 });
CopyTradeSchema.index({ traderId: 1, isActive: 1 });

export const CopyTrade: Model<CopyTrade> =
  (models?.CopyTrade as Model<CopyTrade>) || 
  model<CopyTrade>('CopyTrade', CopyTradeSchema);

// Model for tracking copied trades
export interface CopiedTrade extends Document {
  followerId: string;
  traderId: string;
  originalTransactionId: string; // Reference to trader's transaction
  copiedTransactionId: string; // Reference to follower's transaction
  assetType: 'stock' | 'crypto' | 'forex' | 'futures' | 'options';
  symbol: string;
  copyPercentage: number;
  timestamp: Date;
}

const CopiedTradeSchema = new Schema<CopiedTrade>(
  {
    followerId: { type: String, required: true, index: true },
    traderId: { type: String, required: true, index: true },
    originalTransactionId: { type: String, required: true, index: true },
    copiedTransactionId: { type: String, required: true, index: true },
    assetType: { 
      type: String, 
      required: true, 
      enum: ['stock', 'crypto', 'forex', 'futures', 'options'],
      index: true
    },
    symbol: { type: String, required: true, uppercase: true, index: true },
    copyPercentage: { type: Number, required: true, min: 0, max: 100 },
    timestamp: { type: Date, default: Date.now, index: true }
  },
  { timestamps: false }
);

// Indexes
CopiedTradeSchema.index({ followerId: 1, timestamp: -1 });
CopiedTradeSchema.index({ traderId: 1, timestamp: -1 });

export const CopiedTrade: Model<CopiedTrade> =
  (models?.CopiedTrade as Model<CopiedTrade>) || 
  model<CopiedTrade>('CopiedTrade', CopiedTradeSchema);

