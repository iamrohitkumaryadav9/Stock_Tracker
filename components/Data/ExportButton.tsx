'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportButtonProps {
    data: any[];
    filename?: string;
    label?: string;
}

export default function ExportButton({ data, filename = 'export', label = 'Export' }: ExportButtonProps) {
    const handleExportCSV = () => {
        try {
            if (!data || data.length === 0) {
                toast.error('No data to export');
                return;
            }

            const worksheet = XLSX.utils.json_to_sheet(data);
            const csv = XLSX.utils.sheet_to_csv(worksheet);

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);

            link.setAttribute('href', url);
            link.setAttribute('download', `${filename}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success('Exported to CSV');
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export CSV');
        }
    };

    const handleExportExcel = () => {
        try {
            if (!data || data.length === 0) {
                toast.error('No data to export');
                return;
            }

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

            XLSX.writeFile(workbook, `${filename}.xlsx`);

            toast.success('Exported to Excel');
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export Excel');
        }
    };

    const handleExportPDF = () => {
        try {
            if (!data || data.length === 0) {
                toast.error('No data to export');
                return;
            }

            const doc = new jsPDF();
            const keys = Object.keys(data[0]);

            // @ts-ignore
            autoTable(doc, {
                head: [keys],
                body: data.map(row => keys.map(key => row[key])),
            });

            doc.save(`${filename}.pdf`);

            toast.success('Exported to PDF');
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export PDF');
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    {label}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>
                    Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}>
                    Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>
                    Export as PDF
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
