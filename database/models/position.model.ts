import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface Position extends Document {
  userId: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  totalCost: number;
  createdAt: Date;
  updatedAt: Date;
}

const PositionSchema = new Schema<Position>(
  {
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    averagePrice: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

// Prevent duplicate positions per user
PositionSchema.index({ userId: 1, symbol: 1 }, { unique: true });

export const Position: Model<Position> =
  (models?.Position as Model<Position>) || model<Position>('Position', PositionSchema);

