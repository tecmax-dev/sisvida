import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useChatConversation } from '@/hooks/useChatConversation';
import { useChatAvailability } from '@/hooks/useChatAvailability';
import { useChatAttachment } from '@/hooks/useChatAttachment';
import { ChatMessages } from './ChatMessages';
import { SectorSelector } from './SectorSelector';
import { AttachmentUpload } from './AttachmentUpload';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ChatWindowProps {
  onClose: () => void;
}

interface Sector {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
}

export const ChatWindow = ({ onClose }: ChatWindowProps) => {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSectorSelector, setShowSectorSelector] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { 
    conversation, 
    messages, 
    isLoading, 
    sendMessage, 
    sendMessageWithAttachment,
    initializeWithSector 
  } = useChatConversation();
  const { status, message: offlineMessage } = useChatAvailability();
  const { uploadAttachment, isUploading, progress } = useChatAttachment();

  // Show sector selector if no conversation exists
  useEffect(() => {
    if (!isLoading && !conversation) {
      setShowSectorSelector(true);
    }
  }, [isLoading, conversation]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    if (conversation) {
      inputRef.current?.focus();
    }
  }, [conversation]);

  const handleSectorSelect = async (sector: Sector) => {
    await initializeWithSector(sector.id, sector.name);
    setShowSectorSelector(false);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if ((!inputValue.trim() && !selectedFile) || isSending || isUploading) return;

    setIsSending(true);
    const text = inputValue;
    setInputValue('');

    try {
      if (selectedFile && conversation) {
        // Upload attachment first
        const attachmentData = await uploadAttachment(selectedFile, conversation.id);
        if (attachmentData) {
          await sendMessageWithAttachment(text, attachmentData);
        } else {
          toast.error('Erro ao enviar anexo');
          setInputValue(text); // Restore text
        }
        setSelectedFile(null);
      } else {
        await sendMessage(text);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    }

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
    <>
      <SectorSelector
        open={showSectorSelector}
        onClose={() => setShowSectorSelector(false)}
        onSelect={handleSectorSelect}
      />

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
              <div className="flex items-center gap-2">
                <p className="text-xs text-primary-foreground/80">
                  {status === 'online' ? 'Online' : 'Offline'}
                </p>
                {conversation?.sector_name && (
                  <Badge 
                    variant="secondary" 
                    className="text-[10px] px-1.5 py-0 h-4 bg-primary-foreground/20 text-primary-foreground"
                  >
                    {conversation.sector_name}
                  </Badge>
                )}
              </div>
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
          {/* Attachment Preview */}
          {selectedFile && (
            <div className="mb-2">
              <AttachmentUpload
                selectedFile={selectedFile}
                onFileSelect={setSelectedFile}
                isUploading={isUploading}
                progress={progress}
                disabled={isSending}
              />
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {!selectedFile && (
              <AttachmentUpload
                selectedFile={null}
                onFileSelect={setSelectedFile}
                isUploading={isUploading}
                progress={progress}
                disabled={isSending}
              />
            )}
            
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              disabled={isSending || isUploading || !conversation}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={(!inputValue.trim() && !selectedFile) || isSending || isUploading || !conversation}
              size="icon"
            >
              {isSending || isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
