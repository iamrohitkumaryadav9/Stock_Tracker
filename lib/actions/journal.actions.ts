'use server';

import { connectToDatabase } from '@/database/mongoose';
import JournalEntry from '@/database/models/journal.model';
import { revalidatePath } from 'next/cache';

export interface CreateJournalEntryParams {
    userId: string;
    symbol: string;
    entryDate: Date;
    type: 'buy' | 'sell';
    price: number;
    quantity: number;
    notes?: string;
    tags?: string[];
    mood?: string;
}

export async function createJournalEntry(params: CreateJournalEntryParams) {
    try {
        await connectToDatabase();

        const newEntry = await JournalEntry.create(params);
        revalidatePath('/journal');
        return JSON.parse(JSON.stringify(newEntry));
    } catch (error) {
        console.error('Error creating journal entry:', error);
        throw new Error('Failed to create journal entry');
    }
}

export async function getJournalEntries(userId: string) {
    try {
        await connectToDatabase();

        const entries = await JournalEntry.find({ userId }).sort({ entryDate: -1 });
        return JSON.parse(JSON.stringify(entries));
    } catch (error) {
        console.error('Error fetching journal entries:', error);
        throw new Error('Failed to fetch journal entries');
    }
}

export async function updateJournalEntry(id: string, updateData: Partial<CreateJournalEntryParams>) {
    try {
        await connectToDatabase();

        const updatedEntry = await JournalEntry.findByIdAndUpdate(id, updateData, { new: true });
        if (!updatedEntry) throw new Error('Journal entry not found');

        revalidatePath('/journal');
        return JSON.parse(JSON.stringify(updatedEntry));
    } catch (error) {
        console.error('Error updating journal entry:', error);
        throw new Error('Failed to update journal entry');
    }
}

export async function deleteJournalEntry(id: string) {
    try {
        await connectToDatabase();

        const deletedEntry = await JournalEntry.findByIdAndDelete(id);
        if (!deletedEntry) throw new Error('Journal entry not found');

        revalidatePath('/journal');
        return JSON.parse(JSON.stringify(deletedEntry));
    } catch (error) {
        console.error('Error deleting journal entry:', error);
        throw new Error('Failed to delete journal entry');
    }
}
