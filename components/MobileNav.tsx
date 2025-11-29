'use client';

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import SearchCommand from "@/components/SearchCommand";
import { useState } from "react";

const MobileNav = ({ initialStocks }: { initialStocks: any[] }) => {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const isActive = (path: string) => {
        if (path === '/') return pathname === '/';
        return pathname.startsWith(path);
    }

    return (
        <nav className="sm:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger>
                    <Menu className="h-6 w-6 text-gray-100" />
                </SheetTrigger>
                <SheetContent side="right" className="bg-[#0B0E14] border-gray-800 text-gray-100">
                    <div className="flex flex-col gap-8 mt-8">
                        <Link href="/" onClick={() => setOpen(false)}>
                            <Image src="/assets/icons/logo-quantis.svg" alt="Quantis logo" width={120} height={28} className="h-7 w-auto" />
                        </Link>

                        <div className="flex flex-col gap-4">
                            {NAV_ITEMS.map(({ href, label }) => {
                                if (href === '/search') return (
                                    <div key="search-trigger" onClick={() => setOpen(false)}>
                                        <SearchCommand
                                            renderAs="text"
                                            label="Search"
                                            initialStocks={initialStocks}
                                        />
                                    </div>
                                )

                                return (
                                    <Link
                                        key={href}
                                        href={href}
                                        onClick={() => setOpen(false)}
                                        className={`text-lg font-medium p-2 rounded-lg transition-colors ${isActive(href) ? 'bg-gray-800 text-yellow-500' : 'text-gray-300 hover:text-yellow-500'
                                            }`}
                                    >
                                        {label}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </nav>
    );
};

export default MobileNav;
