"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

const SheetContext = React.createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
} | null>(null);

const Sheet = ({ children, open: controlledOpen, onOpenChange }: { children: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void }) => {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : uncontrolledOpen;
    const setOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

    return (
        <SheetContext.Provider value={{ open, setOpen }}>
            {children}
        </SheetContext.Provider>
    );
};

const SheetTrigger = ({ children, asChild }: { children: React.ReactNode, asChild?: boolean }) => {
    const context = React.useContext(SheetContext);
    if (!context) throw new Error("SheetTrigger must be used within Sheet");

    return (
        <div onClick={() => context.setOpen(true)} className="cursor-pointer">
            {children}
        </div>
    );
};

const SheetContent = ({ children, side = "right", className }: { children: React.ReactNode, side?: "left" | "right", className?: string }) => {
    const context = React.useContext(SheetContext);
    if (!context) throw new Error("SheetContent must be used within Sheet");

    if (!context.open) return null;

    return (
        <>
            <div
                className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
                onClick={() => context.setOpen(false)}
            />
            <div
                className={cn(
                    "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out duration-300",
                    side === "right" ? "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm" : "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
                    className
                )}
            >
                <div className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
                    <X className="h-4 w-4 cursor-pointer" onClick={() => context.setOpen(false)} />
                    <span className="sr-only">Close</span>
                </div>
                {children}
            </div>
        </>
    );
};

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
)

const SheetTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
))
SheetTitle.displayName = "SheetTitle"

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle }
