'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Check, ChevronsUpDown, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { createPortfolio } from '@/lib/actions/portfolio.actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Portfolio {
    _id: string;
    name: string;
    cashBalance: number;
    totalValue: number;
}

interface PortfolioSelectorProps {
    userId: string;
    portfolios: Portfolio[];
    currentPortfolioId: string;
}

export default function PortfolioSelector({ userId, portfolios, currentPortfolioId }: PortfolioSelectorProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newPortfolioName, setNewPortfolioName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const currentPortfolio = portfolios.find(p => p._id === currentPortfolioId) || portfolios[0];

    const handleSelect = (portfolioId: string) => {
        setOpen(false);
        router.push(`/portfolio?portfolioId=${portfolioId}`);
    };

    const handleCreatePortfolio = async () => {
        if (!newPortfolioName.trim()) return;

        setIsCreating(true);
        try {
            const newPortfolio = await createPortfolio(userId, newPortfolioName);
            if (newPortfolio) {
                toast.success('Portfolio created successfully');
                setShowCreateDialog(false);
                setNewPortfolioName('');
                router.push(`/portfolio?portfolioId=${newPortfolio._id}`);
                router.refresh();
            } else {
                toast.error('Failed to create portfolio');
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-[250px] justify-between bg-[#1E222D] border-[#2A2E39] text-gray-100 hover:bg-[#2A2E39] hover:text-white"
                    >
                        <div className="flex items-center gap-2 truncate">
                            <Wallet className="w-4 h-4 text-blue-400" />
                            {currentPortfolio?.name || 'Select Portfolio'}
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0 bg-[#1E222D] border-[#2A2E39]">
                    <Command className="bg-[#1E222D]">
                        <CommandInput placeholder="Search portfolio..." className="text-gray-100" />
                        <CommandList>
                            <CommandEmpty>No portfolio found.</CommandEmpty>
                            <CommandGroup>
                                {portfolios.map((portfolio) => (
                                    <CommandItem
                                        key={portfolio._id}
                                        value={portfolio.name}
                                        onSelect={() => handleSelect(portfolio._id)}
                                        className="text-gray-200 aria-selected:bg-[#2A2E39] aria-selected:text-white cursor-pointer"
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                currentPortfolioId === portfolio._id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {portfolio.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                        <div className="p-2 border-t border-[#2A2E39]">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-blue-400 hover:text-blue-300 hover:bg-[#2A2E39]"
                                onClick={() => {
                                    setOpen(false);
                                    setShowCreateDialog(true);
                                }}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Create New Portfolio
                            </Button>
                        </div>
                    </Command>
                </PopoverContent>
            </Popover>

            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="bg-[#1E222D] border-[#2A2E39] text-gray-100">
                    <DialogHeader>
                        <DialogTitle>Create New Portfolio</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Give your new portfolio a name to get started.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name" className="text-gray-200">Name</Label>
                            <Input
                                id="name"
                                value={newPortfolioName}
                                onChange={(e) => setNewPortfolioName(e.target.value)}
                                placeholder="e.g., Long Term Holds"
                                className="bg-[#131722] border-[#2A2E39] text-gray-100 focus-visible:ring-blue-500"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowCreateDialog(false)}
                            className="bg-transparent border-[#2A2E39] text-gray-300 hover:bg-[#2A2E39] hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreatePortfolio}
                            disabled={!newPortfolioName.trim() || isCreating}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {isCreating ? 'Creating...' : 'Create Portfolio'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
