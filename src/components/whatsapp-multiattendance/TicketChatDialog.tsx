import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  useWhatsAppMessages, 
  useWhatsAppOperators,
  useWhatsAppQuickReplies 
} from '@/hooks/useWhatsAppMultiattendance';
import { 
  WhatsAppTicket, 
  WhatsAppTicketMessage,
  TICKET_STATUS_LABELS 
} from '@/types/whatsapp-multiattendance';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Send, 
  Phone, 
  User, 
  Clock, 
  Bot, 
  Zap,
  Image,
  FileText,
  Mic,
  Video,
  Loader2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface TicketChatDialogProps {
  ticket: WhatsAppTicket | null;
  onClose: () => void;
  clinicId: string | undefined;
}

export function TicketChatDialog({ ticket, onClose, clinicId }: TicketChatDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { messages, isLoading, sendMessage } = useWhatsAppMessages(ticket?.id);
  const { currentOperator } = useWhatsAppOperators(clinicId);
  const { quickReplies } = useWhatsAppQuickReplies(clinicId);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isSending || !currentOperator) return;

    setIsSending(true);
    const text = inputValue;
    setInputValue('');

    try {
      await sendMessage(text, currentOperator.id, currentOperator.name);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(`Erro ao enviar mensagem: ${error?.message || 'Erro desconhecido'}`);
      setInputValue(text);
    }

    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickReply = (content: string) => {
    // Replace variables
    let text = content;
    if (ticket?.contact) {
      text = text.replace(/\{\{nome\}\}/gi, ticket.contact.name || '');
      text = text.replace(/\{\{telefone\}\}/gi, ticket.contact.phone || '');
    }
    text = text.replace(/\{\{protocolo\}\}/gi, ticket?.protocol || '');
    
    setInputValue(text);
  };

  if (!ticket) return null;

  const contactName = ticket.contact?.name || ticket.contact?.phone || 'Contato';
  const initials = contactName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Dialog open={!!ticket} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={ticket.contact?.profile_picture_url || undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-base">{contactName}</DialogTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {ticket.contact?.phone}
                  <span className="text-xs">•</span>
                  <Badge variant="outline" className="text-xs font-mono">
                    {ticket.protocol}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {ticket.sector && (
                <Badge 
                  variant="secondary"
                  style={{ backgroundColor: `${ticket.sector.color}20`, color: ticket.sector.color }}
                >
                  {ticket.sector.name}
                </Badge>
              )}
              <Badge variant="outline">
                {TICKET_STATUS_LABELS[ticket.status]}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageBubbleIcon className="h-12 w-12 mb-2 opacity-50" />
              <p className="text-sm">Nenhuma mensagem ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <MessageBubble 
                  key={message.id} 
                  message={message}
                  showDate={
                    index === 0 || 
                    new Date(message.created_at).toDateString() !== 
                    new Date(messages[index - 1].created_at).toDateString()
                  }
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t bg-muted/30">
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon">
                  <Zap className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Respostas Rápidas
                </p>
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {quickReplies.map((qr) => (
                      <Button
                        key={qr.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-left h-auto py-2"
                        onClick={() => handleQuickReply(qr.content)}
                      >
                        <div>
                          <p className="text-sm font-medium">{qr.title}</p>
                          {qr.shortcut && (
                            <p className="text-xs text-muted-foreground">/{qr.shortcut}</p>
                          )}
                        </div>
                      </Button>
                    ))}
                    {quickReplies.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Nenhuma resposta rápida cadastrada
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              disabled={isSending || !currentOperator}
              className="flex-1"
            />

            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isSending || !currentOperator}
              size="icon"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {!currentOperator && (
            <p className="text-xs text-destructive mt-2">
              Você precisa ser um operador para enviar mensagens
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MessageBubbleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface MessageBubbleProps {
  message: WhatsAppTicketMessage;
  showDate: boolean;
}

function MessageBubble({ message, showDate }: MessageBubbleProps) {
  const isFromMe = message.sender_type === 'operator';
  const isSystem = message.sender_type === 'system';
  const isBot = message.sender_type === 'bot';

  const getMessageIcon = () => {
    switch (message.message_type) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'audio': return <Mic className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      default: return null;
    }
  };

  if (isSystem) {
    return (
      <>
        {showDate && <DateSeparator date={message.created_at} />}
        <div className="flex justify-center">
          <div className="bg-muted px-3 py-1.5 rounded-full text-xs text-muted-foreground">
            {message.content}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {showDate && <DateSeparator date={message.created_at} />}
      <div className={cn("flex", isFromMe ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "max-w-[70%] rounded-lg px-3 py-2 space-y-1",
            isFromMe 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted"
          )}
        >
          {/* Sender info for non-self messages */}
          {!isFromMe && (
            <div className="flex items-center gap-1.5 text-xs opacity-70">
              {isBot ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
              <span>{message.sender_name || (isBot ? 'Assistente' : 'Contato')}</span>
            </div>
          )}

          {/* Media preview */}
          {message.message_type !== 'text' && message.media_url && (
            <div className="flex items-center gap-2 text-sm opacity-80">
              {getMessageIcon()}
              <span>Mídia</span>
            </div>
          )}

          {/* Message text */}
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}

          {/* Timestamp */}
          <div className={cn(
            "flex items-center gap-1 text-[10px]",
            isFromMe ? "text-primary-foreground/70 justify-end" : "text-muted-foreground"
          )}>
            <Clock className="h-3 w-3" />
            {format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}
          </div>
        </div>
      </div>
    </>
  );
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-4 my-4">
      <Separator className="flex-1" />
      <span className="text-xs text-muted-foreground">
        {format(new Date(date), "d 'de' MMMM", { locale: ptBR })}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}
