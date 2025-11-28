import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface Backtest extends Document {
  userId: string;
  name: string;
  description?: string;
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  strategy: {
    type: 'buy_and_hold' | 'moving_average' | 'rsi' | 'custom';
    parameters: Record<string, any>;
  };
  results: {
    finalValue: number;
    totalReturn: number;
    totalReturnPercent: number;
    maxDrawdown: number;
    sharpeRatio?: number;
    trades: Array<{
      date: Date;
      type: 'buy' | 'sell';
      price: number;
      quantity: number;
      reason: string;
    }>;
    equityCurve: Array<{
      date: Date;
      value: number;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
}

const BacktestSchema = new Schema<Backtest>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    symbol: { type: String, required: true, uppercase: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    initialCapital: { type: Number, required: true, default: 10000 },
    strategy: {
      type: {
        type: String,
        required: true,
        enum: ['buy_and_hold', 'moving_average', 'rsi', 'custom']
      },
      parameters: { type: Schema.Types.Mixed, default: {} }
    },
    results: {
      finalValue: { type: Number },
      totalReturn: { type: Number },
      totalReturnPercent: { type: Number },
      maxDrawdown: { type: Number },
      sharpeRatio: { type: Number },
      trades: [{
        date: { type: Date },
        type: { type: String, enum: ['buy', 'sell'] },
        price: { type: Number },
        quantity: { type: Number },
        reason: { type: String }
      }],
      equityCurve: [{
        date: { type: Date },
        value: { type: Number }
      }]
    }
  },
  { timestamps: true }
);

BacktestSchema.index({ userId: 1, createdAt: -1 });
BacktestSchema.index({ symbol: 1, createdAt: -1 });

export const Backtest: Model<Backtest> =
  (models?.Backtest as Model<Backtest>) || model<Backtest>('Backtest', BacktestSchema);

