import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface Portfolio extends Document {
  userId: string;
  cashBalance: number;
  totalValue: number;
  createdAt: Date;
  updatedAt: Date;
}

const PortfolioSchema = new Schema<Portfolio>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    cashBalance: { type: Number, required: true, default: 100000 }, // Starting with $100,000 virtual cash
    totalValue: { type: Number, required: true, default: 100000 },
  },
  { timestamps: true }
);

export const Portfolio: Model<Portfolio> =
  (models?.Portfolio as Model<Portfolio>) || model<Portfolio>('Portfolio', PortfolioSchema);

