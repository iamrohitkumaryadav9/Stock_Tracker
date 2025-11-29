'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Upload, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { processImportedTrades, ImportTradeData } from '@/lib/actions/import.actions';
import { useRouter } from 'next/navigation';

interface ImportTradesProps {
    userId: string;
    portfolioId: string;
}

export default function ImportTrades({ userId, portfolioId }: ImportTradesProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [source, setSource] = useState('generic');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const parseCSV = (file: File): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => resolve(results.data),
                error: (error) => reject(error),
            });
        });
    };

    const mapData = (data: any[], source: string): ImportTradeData[] => {
        return data.map((row) => {
            let symbol, date, type, quantity, price;

            if (source === 'robinhood') {
                // Robinhood CSV format (Example)
                // symbol, date, order_type, side, fees, quantity, average_price
                symbol = row['symbol'];
                date = row['date'];
                type = row['side']; // 'buy' or 'sell'
                quantity = row['quantity'];
                price = row['average_price'];
            } else if (source === 'td_ameritrade') {
                // TD Ameritrade CSV format (Example)
                // Symbol, Transaction Date, Transaction Type, Quantity, Price, Amount
                symbol = row['Symbol'];
                date = row['Transaction Date'];
                type = row['Transaction Type'].toLowerCase().includes('bought') ? 'buy' : 'sell';
                quantity = row['Quantity'];
                price = row['Price'];
            } else {
                // Generic format
                // Symbol, Date, Type, Quantity, Price
                symbol = row['Symbol'] || row['symbol'];
                date = row['Date'] || row['date'];
                type = row['Type']?.toLowerCase() || row['type']?.toLowerCase();
                quantity = row['Quantity'] || row['quantity'];
                price = row['Price'] || row['price'];
            }

            return {
                symbol,
                date,
                type: type === 'buy' || type === 'sell' ? type : 'buy', // Default to buy if unclear, ideally validate
                quantity: parseFloat(quantity),
                price: parseFloat(price),
            };
        }).filter(item => item.symbol && !isNaN(item.quantity) && !isNaN(item.price));
    };

    const handleImport = async () => {
        if (!file) {
            toast.error('Please select a file');
            return;
        }

        setLoading(true);
        try {
            const rawData = await parseCSV(file);
            const mappedData = mapData(rawData, source);

            if (mappedData.length === 0) {
                toast.error('No valid trades found in CSV');
                setLoading(false);
                return;
            }

            const result = await processImportedTrades(userId, portfolioId, mappedData);

            if (result.success) {
                toast.success(result.message);
                setIsOpen(false);
                setFile(null);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            console.error('Import error:', error);
            toast.error('Failed to parse CSV file');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Import Trades
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-gray-800 text-gray-100 border-gray-700">
                <DialogHeader>
                    <DialogTitle>Import Trades</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Upload a CSV file to import your trade history.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="source">Source</Label>
                        <Select value={source} onValueChange={setSource}>
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                                <SelectValue placeholder="Select source" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-700 border-gray-600 text-white">
                                <SelectItem value="generic">Generic CSV</SelectItem>
                                <SelectItem value="robinhood">Robinhood</SelectItem>
                                <SelectItem value="td_ameritrade">TD Ameritrade</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="file">CSV File</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="file"
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="bg-gray-700 border-gray-600 text-white cursor-pointer"
                            />
                        </div>
                        {file && (
                            <p className="text-sm text-gray-400 flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {file.name}
                            </p>
                        )}
                    </div>
                    <div className="text-xs text-gray-500">
                        <p className="font-semibold mb-1">Generic CSV Format:</p>
                        <p>Symbol, Date, Type (buy/sell), Quantity, Price</p>
                    </div>
                </div>
                <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => setIsOpen(false)} className="text-gray-300 hover:text-white hover:bg-gray-700">
                        Cancel
                    </Button>
                    <Button onClick={handleImport} disabled={loading || !file} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Importing...
                            </>
                        ) : (
                            'Import'
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
