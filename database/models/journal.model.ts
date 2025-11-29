import { Schema, model, models, Document } from 'mongoose';

export interface IJournalEntry extends Document {
    userId: string;
    symbol: string;
    entryDate: Date;
    type: 'buy' | 'sell';
    price: number;
    quantity: number;
    notes?: string;
    tags?: string[];
    mood?: 'confident' | 'fearful' | 'neutral' | 'greedy' | 'excited' | 'frustrated';
    createdAt: Date;
    updatedAt: Date;
}

const JournalEntrySchema = new Schema<IJournalEntry>(
    {
        userId: { type: String, required: true, index: true },
        symbol: { type: String, required: true },
        entryDate: { type: Date, required: true, default: Date.now },
        type: { type: String, required: true, enum: ['buy', 'sell'] },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
        notes: { type: String },
        tags: { type: [String], default: [] },
        mood: {
            type: String,
            enum: ['confident', 'fearful', 'neutral', 'greedy', 'excited', 'frustrated'],
            default: 'neutral'
        }
    },
    { timestamps: true }
);

const JournalEntry = models.JournalEntry || model<IJournalEntry>('JournalEntry', JournalEntrySchema);

export default JournalEntry;
