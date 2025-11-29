'use client';

import { useState, useRef, useEffect } from 'react';
import { chatWithData } from '@/lib/actions/ai-analysis.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, X, Send, Bot, Loader2, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
    role: 'user' | 'bot';
    content: string;
}

const QuantisBot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'bot', content: 'Hello! I am Quantis Bot. Ask me anything about stocks or your portfolio.' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const response = await chatWithData(userMsg);
            setMessages(prev => [...prev, { role: 'bot', content: response }]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'bot', content: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <Button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20 z-50 flex items-center justify-center transition-transform hover:scale-105"
            >
                <Bot className="w-8 h-8 text-white" />
            </Button>
        );
    }

    return (
        <div className={cn(
            "fixed bottom-4 right-4 md:bottom-6 md:right-6 bg-[#1E222D] border border-[#2A2E39] shadow-2xl z-50 transition-all duration-300 overflow-hidden flex flex-col",
            isMinimized ? "w-64 md:w-72 h-14 rounded-t-xl" : "w-[calc(100vw-2rem)] md:w-[380px] h-[500px] md:h-[600px] rounded-xl"
        )}>
            {/* Header */}
            <div
                className="flex items-center justify-between p-4 bg-[#2A2E39] cursor-pointer"
                onClick={() => setIsMinimized(!isMinimized)}
            >
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <h3 className="font-semibold text-gray-100">Quantis Bot</h3>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-white" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
                        {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-white" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Chat Area */}
            {!isMinimized && (
                <>
                    <div className="flex-1 p-4 bg-[#131722] overflow-y-auto custom-scrollbar" ref={scrollRef}>
                        <div className="space-y-4">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                                    <div className={cn(
                                        "max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
                                        msg.role === 'user'
                                            ? "bg-blue-600 text-white rounded-br-none"
                                            : "bg-[#2A2E39] text-gray-200 rounded-bl-none"
                                    )}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="bg-[#2A2E39] rounded-2xl rounded-bl-none px-4 py-2 flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                        <span className="text-xs text-gray-400">Thinking...</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-[#1E222D] border-t border-[#2A2E39]">
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                            className="flex items-center gap-2"
                        >
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask about stocks..."
                                className="bg-[#131722] border-[#2A2E39] text-gray-100 focus-visible:ring-blue-600"
                            />
                            <Button type="submit" size="icon" disabled={loading || !input.trim()} className="bg-blue-600 hover:bg-blue-700">
                                <Send className="w-4 h-4" />
                            </Button>
                        </form>
                    </div>
                </>
            )}
        </div>
    );
};

export default QuantisBot;
