import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface Transaction extends Document {
  userId: string;
  assetType: 'stock' | 'crypto' | 'forex' | 'futures' | 'options';
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  totalAmount: number;
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
  // Copy trading
  isCopied?: boolean;
  copiedFromUserId?: string;
  timestamp: Date;
}

const TransactionSchema = new Schema<Transaction>(
  {
    userId: { type: String, required: true, index: true },
    assetType: { 
      type: String, 
      required: true, 
      enum: ['stock', 'crypto', 'forex', 'futures', 'options'],
      default: 'stock',
      index: true
    },
    symbol: { type: String, required: true, uppercase: true, index: true },
    type: { type: String, required: true, enum: ['buy', 'sell'] },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true },
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
    // Copy trading
    isCopied: { type: Boolean, default: false },
    copiedFromUserId: { type: String, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

// Index for efficient queries
TransactionSchema.index({ userId: 1, timestamp: -1 });
TransactionSchema.index({ userId: 1, symbol: 1 });
TransactionSchema.index({ userId: 1, assetType: 1 });
TransactionSchema.index({ copiedFromUserId: 1, timestamp: -1 });

export const Transaction: Model<Transaction> =
  (models?.Transaction as Model<Transaction>) || model<Transaction>('Transaction', TransactionSchema);

