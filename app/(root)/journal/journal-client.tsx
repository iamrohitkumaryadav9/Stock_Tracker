'use client';

import { useState } from 'react';
import { createJournalEntry, deleteJournalEntry } from '@/lib/actions/journal.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trash2, TrendingUp, TrendingDown, Calendar, DollarSign, Hash, Smile, Frown, Meh } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JournalClientProps {
    initialEntries: any[];
    userId: string;
}

export default function JournalClient({ initialEntries, userId }: JournalClientProps) {
    const [entries, setEntries] = useState(initialEntries);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        symbol: '',
        entryDate: new Date().toISOString().split('T')[0],
        type: 'buy',
        price: '',
        quantity: '',
        notes: '',
        mood: 'neutral'
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const newEntry = await createJournalEntry({
                userId,
                symbol: formData.symbol.toUpperCase(),
                entryDate: new Date(formData.entryDate),
                type: formData.type as 'buy' | 'sell',
                price: parseFloat(formData.price),
                quantity: parseFloat(formData.quantity),
                notes: formData.notes,
                mood: formData.mood
            });

            setEntries([newEntry, ...entries]);
            setIsOpen(false);
            toast.success('Journal entry added successfully');
            setFormData({
                symbol: '',
                entryDate: new Date().toISOString().split('T')[0],
                type: 'buy',
                price: '',
                quantity: '',
                notes: '',
                mood: 'neutral'
            });
        } catch (error) {
            console.error(error);
            toast.error('Failed to add journal entry');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteJournalEntry(id);
            setEntries(entries.filter(e => e._id !== id));
            toast.success('Entry deleted');
        } catch (error) {
            toast.error('Failed to delete entry');
        }
    };

    const getMoodIcon = (mood: string) => {
        switch (mood) {
            case 'confident':
            case 'excited':
            case 'greedy':
                return <Smile className="w-4 h-4 text-green-400" />;
            case 'fearful':
            case 'frustrated':
                return <Frown className="w-4 h-4 text-red-400" />;
            default:
                return <Meh className="w-4 h-4 text-yellow-400" />;
        }
    };

    return (
        <div>
            <div className="flex justify-end mb-6">
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="w-4 h-4 mr-2" />
                            Log New Trade
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#1E222D] border-[#2A2E39] text-gray-100 sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Log Trade Entry</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="symbol">Symbol</Label>
                                    <Input
                                        id="symbol"
                                        name="symbol"
                                        placeholder="AAPL"
                                        value={formData.symbol}
                                        onChange={handleInputChange}
                                        required
                                        className="bg-[#2A2E39] border-gray-700 text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="entryDate">Date</Label>
                                    <Input
                                        id="entryDate"
                                        name="entryDate"
                                        type="date"
                                        value={formData.entryDate}
                                        onChange={handleInputChange}
                                        required
                                        className="bg-[#2A2E39] border-gray-700 text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="type">Type</Label>
                                    <Select name="type" value={formData.type} onValueChange={(val) => handleSelectChange('type', val)}>
                                        <SelectTrigger className="bg-[#2A2E39] border-gray-700 text-white">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#2A2E39] border-gray-700 text-white">
                                            <SelectItem value="buy">Buy</SelectItem>
                                            <SelectItem value="sell">Sell</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="mood">Mood</Label>
                                    <Select name="mood" value={formData.mood} onValueChange={(val) => handleSelectChange('mood', val)}>
                                        <SelectTrigger className="bg-[#2A2E39] border-gray-700 text-white">
                                            <SelectValue placeholder="Select mood" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#2A2E39] border-gray-700 text-white">
                                            <SelectItem value="neutral">Neutral</SelectItem>
                                            <SelectItem value="confident">Confident</SelectItem>
                                            <SelectItem value="excited">Excited</SelectItem>
                                            <SelectItem value="greedy">Greedy</SelectItem>
                                            <SelectItem value="fearful">Fearful</SelectItem>
                                            <SelectItem value="frustrated">Frustrated</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="price">Price ($)</Label>
                                    <Input
                                        id="price"
                                        name="price"
                                        type="number"
                                        step="0.01"
                                        placeholder="150.00"
                                        value={formData.price}
                                        onChange={handleInputChange}
                                        required
                                        className="bg-[#2A2E39] border-gray-700 text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="quantity">Quantity</Label>
                                    <Input
                                        id="quantity"
                                        name="quantity"
                                        type="number"
                                        step="0.01"
                                        placeholder="10"
                                        value={formData.quantity}
                                        onChange={handleInputChange}
                                        required
                                        className="bg-[#2A2E39] border-gray-700 text-white"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea
                                    id="notes"
                                    name="notes"
                                    placeholder="Why did you take this trade? How were you feeling?"
                                    value={formData.notes}
                                    onChange={handleInputChange}
                                    className="bg-[#2A2E39] border-gray-700 text-white min-h-[100px]"
                                />
                            </div>

                            <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                                {loading ? 'Saving...' : 'Save Entry'}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {entries.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-500">
                        No journal entries yet. Start logging your trades!
                    </div>
                ) : (
                    entries.map((entry) => (
                        <div key={entry._id} className="bg-[#1E222D] border border-[#2A2E39] rounded-xl p-5 hover:border-gray-600 transition-colors group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center",
                                        entry.type === 'buy' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                    )}>
                                        {entry.type === 'buy' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">{entry.symbol}</h3>
                                        <span className={cn(
                                            "text-xs font-medium uppercase px-1.5 py-0.5 rounded",
                                            entry.type === 'buy' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                        )}>
                                            {entry.type}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleDelete(entry._id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                                <div className="flex items-center gap-2 text-gray-400">
                                    <DollarSign className="w-4 h-4" />
                                    <span>${entry.price.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-400">
                                    <Hash className="w-4 h-4" />
                                    <span>{entry.quantity} shares</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-400">
                                    <Calendar className="w-4 h-4" />
                                    <span>{new Date(entry.entryDate).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-400 capitalize">
                                    {getMoodIcon(entry.mood)}
                                    <span>{entry.mood}</span>
                                </div>
                            </div>

                            {entry.notes && (
                                <div className="bg-[#2A2E39]/50 p-3 rounded-lg text-sm text-gray-300 italic">
                                    "{entry.notes}"
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
