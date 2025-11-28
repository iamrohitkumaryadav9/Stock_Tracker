import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface Transaction extends Document {
  userId: string;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  totalAmount: number;
  timestamp: Date;
}

const TransactionSchema = new Schema<Transaction>(
  {
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, index: true },
    type: { type: String, required: true, enum: ['buy', 'sell'] },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

// Index for efficient queries
TransactionSchema.index({ userId: 1, timestamp: -1 });
TransactionSchema.index({ userId: 1, symbol: 1 });

export const Transaction: Model<Transaction> =
  (models?.Transaction as Model<Transaction>) || model<Transaction>('Transaction', TransactionSchema);

