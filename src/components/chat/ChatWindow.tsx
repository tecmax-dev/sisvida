import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatConversation } from '@/hooks/useChatConversation';
import { useChatAvailability } from '@/hooks/useChatAvailability';
import { ChatMessages } from './ChatMessages';
import { cn } from '@/lib/utils';

interface ChatWindowProps {
  onClose: () => void;
}

export const ChatWindow = ({ onClose }: ChatWindowProps) => {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { messages, isLoading, sendMessage } = useChatConversation();
  const { status, message: offlineMessage } = useChatAvailability();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    setIsSending(true);
    const text = inputValue;
    setInputValue('');

    await sendMessage(text);
    setIsSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col w-[380px] h-[520px] bg-background border rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <span className="text-lg font-semibold">S</span>
            </div>
            <span
              className={cn(
                'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-primary',
                status === 'online' ? 'bg-green-400' : 'bg-muted'
              )}
            />
          </div>
          <div>
            <h3 className="font-semibold">Suporte</h3>
            <p className="text-xs text-primary-foreground/80">
              {status === 'online' ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-primary-foreground hover:bg-primary-foreground/20"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Offline Message */}
      {status === 'offline' && offlineMessage && (
        <div className="px-4 py-2 bg-muted text-muted-foreground text-sm border-b">
          {offlineMessage}
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p className="text-sm">Olá! Como podemos ajudar?</p>
            <p className="text-xs mt-1">Envie uma mensagem para iniciar.</p>
          </div>
        ) : (
          <ChatMessages messages={messages} />
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="p-3 border-t bg-muted/30">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            disabled={isSending}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending}
            size="icon"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
