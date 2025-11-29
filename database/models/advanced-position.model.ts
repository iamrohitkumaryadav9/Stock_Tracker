import { Schema, model, models, type Document, type Model } from 'mongoose';

// Base position interface
export interface AdvancedPosition extends Document {
  userId: string;
  portfolioId?: any;
  assetType: 'stock' | 'crypto' | 'forex' | 'futures' | 'options';
  symbol: string;
  quantity: number;
  averagePrice: number;
  totalCost: number;
  // Options specific
  optionType?: 'call' | 'put';
  strikePrice?: number;
  expirationDate?: Date;
  // Futures specific
  contractSize?: number;
  contractMonth?: string;
  // Forex specific
  baseCurrency?: string;
  quoteCurrency?: string;
  // Metadata
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const AdvancedPositionSchema = new Schema<AdvancedPosition>(
  {
    userId: { type: String, required: true, index: true },
    portfolioId: { type: Schema.Types.ObjectId, ref: 'Portfolio', index: true },
    assetType: {
      type: String,
      required: true,
      enum: ['stock', 'crypto', 'forex', 'futures', 'options'],
      index: true
    },
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    quantity: { type: Number, required: true, min: 0 },
    averagePrice: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    // Options fields
    optionType: { type: String, enum: ['call', 'put'] },
    strikePrice: { type: Number, min: 0 },
    expirationDate: { type: Date },
    // Futures fields
    contractSize: { type: Number, min: 0 },
    contractMonth: { type: String },
    // Forex fields
    baseCurrency: { type: String, uppercase: true },
    quoteCurrency: { type: String, uppercase: true },
    // Metadata for additional info
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

// Compound index to prevent duplicate positions
AdvancedPositionSchema.index({ userId: 1, portfolioId: 1, assetType: 1, symbol: 1, strikePrice: 1, expirationDate: 1 }, { unique: true });

// Indexes for efficient queries
AdvancedPositionSchema.index({ userId: 1, assetType: 1 });
AdvancedPositionSchema.index({ userId: 1, createdAt: -1 });

export const AdvancedPosition: Model<AdvancedPosition> =
  (models?.AdvancedPosition as Model<AdvancedPosition>) ||
  model<AdvancedPosition>('AdvancedPosition', AdvancedPositionSchema);

