import { useState, useRef, useEffect } from 'react';
import { 
  useWhatsAppTickets, 
  useWhatsAppOperators, 
  useWhatsAppSectors,
  useWhatsAppMessages,
  useWhatsAppQuickReplies
} from '@/hooks/useWhatsAppMultiattendance';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  WhatsAppTicket, 
  WhatsAppTicketMessage,
  WhatsAppTicketStatus,
  TICKET_STATUS_LABELS 
} from '@/types/whatsapp-multiattendance';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Search, 
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
  MessageSquare,
  Filter,
  Users,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Paperclip,
  Smile,
  RefreshCw,
  ArrowLeft,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface ChatLayoutProps {
  clinicId: string | undefined;
}

type TabFilter = 'open' | 'pending' | 'closed' | 'bot';

export function ChatLayout({ clinicId }: ChatLayoutProps) {
  const { tickets, isLoading, updateTicketStatus, assignTicket, refetch } = useWhatsAppTickets(clinicId);
  const { operators, currentOperator } = useWhatsAppOperators(clinicId);
  const { sectors } = useWhatsAppSectors(clinicId);
  const [selectedTicket, setSelectedTicket] = useState<WhatsAppTicket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabFilter>('open');

  // Filter tickets based on active tab
  const filteredTickets = tickets.filter(ticket => {
    // Search filter
    const matchesSearch = searchQuery === '' || 
      ticket.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.contact?.phone?.includes(searchQuery) ||
      ticket.protocol?.includes(searchQuery);

    // Tab filter
    let matchesTab = false;
    switch (activeTab) {
      case 'open':
        matchesTab = ['new', 'in_progress'].includes(ticket.status);
        break;
      case 'pending':
        matchesTab = ticket.status === 'waiting_client';
        break;
      case 'closed':
        matchesTab = ['resolved', 'closed'].includes(ticket.status);
        break;
      case 'bot':
        matchesTab = ticket.is_bot_active === true;
        break;
    }

    return matchesSearch && matchesTab;
  });

  const getTabCount = (tab: TabFilter) => {
    switch (tab) {
      case 'open':
        return tickets.filter(t => ['new', 'in_progress'].includes(t.status)).length;
      case 'pending':
        return tickets.filter(t => t.status === 'waiting_client').length;
      case 'closed':
        return tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length;
      case 'bot':
        return tickets.filter(t => t.is_bot_active).length;
    }
  };

  return (
    <div className="flex h-[calc(100vh-180px)] rounded-lg overflow-hidden border bg-background">
      {/* Sidebar - Ticket List */}
      <div className="w-[380px] border-r flex flex-col bg-card">
        {/* Header */}
        <div className="p-3 border-b space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1">
              <Filter className="h-4 w-4 mr-2" />
              Filtro
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <Users className="h-4 w-4 mr-2" />
              Contatos
            </Button>
            <Button variant="default" size="icon" className="bg-green-600 hover:bg-green-700">
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Status Tabs */}
        <div className="border-b">
          <div className="flex text-xs font-medium">
            <button
              onClick={() => setActiveTab('open')}
              className={cn(
                "flex-1 py-2 px-3 border-b-2 transition-colors",
                activeTab === 'open' 
                  ? "border-green-600 text-green-600" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center justify-center gap-1">
                ABERTOS
                <Badge variant="secondary" className="h-5 min-w-5 text-xs">
                  {getTabCount('open')}
                </Badge>
              </span>
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={cn(
                "flex-1 py-2 px-3 border-b-2 transition-colors",
                activeTab === 'pending' 
                  ? "border-yellow-600 text-yellow-600" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center justify-center gap-1">
                PENDENTES
                <Badge variant="secondary" className="h-5 min-w-5 text-xs">
                  {getTabCount('pending')}
                </Badge>
              </span>
            </button>
            <button
              onClick={() => setActiveTab('closed')}
              className={cn(
                "flex-1 py-2 px-3 border-b-2 transition-colors",
                activeTab === 'closed' 
                  ? "border-gray-600 text-gray-600" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center justify-center gap-1">
                FECHADOS
                <Badge variant="secondary" className="h-5 min-w-5 text-xs">
                  {getTabCount('closed')}
                </Badge>
              </span>
            </button>
            <button
              onClick={() => setActiveTab('bot')}
              className={cn(
                "flex-1 py-2 px-3 border-b-2 transition-colors",
                activeTab === 'bot' 
                  ? "border-blue-600 text-blue-600" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center justify-center gap-1">
                CHATBOT
                <Badge variant="secondary" className="h-5 min-w-5 text-xs">
                  {getTabCount('bot')}
                </Badge>
              </span>
            </button>
          </div>
        </div>

        {/* Ticket List */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Nenhum ticket encontrado</p>
            </div>
          ) : (
            <div>
              {filteredTickets.map((ticket) => (
                <TicketListItem
                  key={ticket.id}
                  ticket={ticket}
                  isSelected={selectedTicket?.id === ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      {selectedTicket ? (
        <ChatWindow 
          ticket={selectedTicket} 
          clinicId={clinicId}
          onBack={() => setSelectedTicket(null)}
          onStatusChange={(status) => updateTicketStatus(selectedTicket.id, status)}
          onAssign={(operatorId) => assignTicket(selectedTicket.id, operatorId)}
          currentOperator={currentOperator}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-muted/30">
          <div className="text-center text-muted-foreground">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="h-8 w-8" />
            </div>
            <h3 className="font-medium mb-1">Selecione uma conversa</h3>
            <p className="text-sm">Escolha um ticket para iniciar o atendimento</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface TicketListItemProps {
  ticket: WhatsAppTicket;
  isSelected: boolean;
  onClick: () => void;
}

function TicketListItem({ ticket, isSelected, onClick }: TicketListItemProps) {
  const contactName = ticket.contact?.name || ticket.contact?.phone || 'Contato';
  const initials = contactName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const isOnline = Math.random() > 0.5; // Placeholder - real status would come from presence

  const getTimeLabel = () => {
    if (!ticket.last_message_at) return '';
    const date = new Date(ticket.last_message_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return format(date, 'HH:mm');
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias`;
    return format(date, 'dd/MM');
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors border-b",
        isSelected && "bg-muted"
      )}
    >
      {/* Avatar with online indicator */}
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={ticket.contact?.profile_picture_url || undefined} />
          <AvatarFallback className="bg-green-100 text-green-700">
            {initials}
          </AvatarFallback>
        </Avatar>
        {isOnline && (
          <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="font-medium text-sm truncate">{contactName}</h4>
              {ticket.is_bot_active && (
                <Bot className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {ticket.last_message || 'Sem mensagens'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <Badge 
              variant="secondary" 
              className="text-[10px] bg-green-100 text-green-700 hover:bg-green-100"
            >
              {getTimeLabel()}
            </Badge>
            {ticket.unread_count && ticket.unread_count > 0 && (
              <Badge className="h-5 min-w-5 bg-green-600 hover:bg-green-600">
                {ticket.unread_count}
              </Badge>
            )}
          </div>
        </div>

        {/* Tags row */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] h-5 font-mono">
            #{ticket.protocol?.replace('T', '')}
          </Badge>
          {ticket.sector && (
            <Badge 
              className="text-[10px] h-5"
              style={{ 
                backgroundColor: `${ticket.sector.color}20`, 
                color: ticket.sector.color,
                borderColor: ticket.sector.color 
              }}
            >
              {ticket.sector.name}
            </Badge>
          )}
          {ticket.assigned_operator && (
            <Badge variant="secondary" className="text-[10px] h-5 bg-green-600 text-white hover:bg-green-600">
              {ticket.assigned_operator.name.split(' ')[0]}
            </Badge>
          )}
        </div>
      </div>

      {/* Read indicator */}
      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-1" />
    </div>
  );
}

interface ChatWindowProps {
  ticket: WhatsAppTicket;
  clinicId: string | undefined;
  onBack: () => void;
  onStatusChange: (status: WhatsAppTicketStatus) => void;
  onAssign: (operatorId: string | null) => void;
  currentOperator: any;
}

function ChatWindow({ ticket, clinicId, onBack, onStatusChange, onAssign, currentOperator }: ChatWindowProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { messages, isLoading, sendMessage } = useWhatsAppMessages(ticket.id);
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
    } catch (error) {
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
    let text = content;
    if (ticket.contact) {
      text = text.replace(/\{\{nome\}\}/gi, ticket.contact.name || '');
      text = text.replace(/\{\{telefone\}\}/gi, ticket.contact.phone || '');
    }
    text = text.replace(/\{\{protocolo\}\}/gi, ticket.protocol || '');
    setInputValue(text);
  };

  const contactName = ticket.contact?.name || ticket.contact?.phone || 'Contato';
  const initials = contactName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="h-16 px-4 border-b flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10">
            <AvatarImage src={ticket.contact?.profile_picture_url || undefined} />
            <AvatarFallback className="bg-green-100 text-green-700">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium text-sm">{contactName}</h3>
            <p className="text-xs text-muted-foreground">
              Atribuído a: {ticket.assigned_operator?.name || 'Não atribuído'} • Ticket: {ticket.protocol}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Phone className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!ticket.assigned_operator_id && currentOperator && (
                <DropdownMenuItem onClick={() => onAssign(currentOperator.id)}>
                  <User className="h-4 w-4 mr-2" />
                  Assumir ticket
                </DropdownMenuItem>
              )}
              {ticket.assigned_operator_id === currentOperator?.id && (
                <DropdownMenuItem onClick={() => onAssign(null)}>
                  <User className="h-4 w-4 mr-2" />
                  Liberar ticket
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onStatusChange('waiting_client')}>
                <Clock className="h-4 w-4 mr-2" />
                Aguardando cliente
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange('resolved')}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Marcar resolvido
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onStatusChange('closed')}
                className="text-destructive"
              >
                Finalizar ticket
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4"
        style={{ 
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5ddd5' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundColor: '#f0ebe3' 
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-4xl mx-auto">
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
      </div>

      {/* Quick Replies Bar */}
      {quickReplies.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/30 overflow-x-auto">
          <div className="flex gap-2">
            {quickReplies.slice(0, 8).map((qr) => (
              <Button
                key={qr.id}
                variant="outline"
                size="sm"
                className="flex-shrink-0 text-xs bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-200"
                onClick={() => handleQuickReply(qr.content)}
              >
                {qr.title}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t bg-card">
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon">
                <Smile className="h-5 w-5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <p className="text-xs text-muted-foreground text-center py-4">
                Emojis em breve...
              </p>
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon">
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </Button>

          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            disabled={isSending || !currentOperator}
            className="flex-1 bg-background"
          />

          <Button variant="ghost" size="icon">
            <Mic className="h-5 w-5 text-muted-foreground" />
          </Button>

          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending || !currentOperator}
            size="icon"
            className="bg-green-600 hover:bg-green-700"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {!currentOperator && (
          <p className="text-xs text-destructive mt-2 text-center">
            Você precisa ser um operador para enviar mensagens
          </p>
        )}
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: WhatsAppTicketMessage;
  showDate: boolean;
}

function MessageBubble({ message, showDate }: MessageBubbleProps) {
  const isFromMe = message.is_from_me;
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
          <div className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg text-xs shadow-sm">
            {message.message}
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
            "max-w-[70%] rounded-lg px-3 py-2 shadow-sm relative",
            isFromMe 
              ? "bg-green-200 text-green-900" 
              : "bg-white text-gray-900"
          )}
        >
          {/* Sender info for bot/operator messages */}
          {isFromMe && (isBot || message.sender_name) && (
            <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium mb-1">
              {isBot ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
              <span>{isBot ? 'CHATGPT' : message.sender_name}</span>
            </div>
          )}

          {/* Media preview */}
          {message.message_type !== 'text' && message.media_url && (
            <div className="flex items-center gap-2 text-sm opacity-80 mb-1">
              {getMessageIcon()}
              <span>{message.media_filename || 'Mídia'}</span>
            </div>
          )}

          {/* Message text */}
          {message.message && (
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {message.message}
            </p>
          )}

          {/* Timestamp */}
          <div className={cn(
            "flex items-center justify-end gap-1 text-[10px] mt-1",
            isFromMe ? "text-green-700" : "text-gray-500"
          )}>
            {format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}
            {isFromMe && (
              <CheckCircle2 className="h-3 w-3" />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex justify-center my-4">
      <div className="bg-white/80 px-3 py-1 rounded-lg text-xs text-gray-600 shadow-sm">
        {format(new Date(date), "dd/MM/yyyy", { locale: ptBR })}
      </div>
    </div>
  );
}
