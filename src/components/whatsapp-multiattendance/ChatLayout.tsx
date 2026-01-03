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
      ticket.id?.includes(searchQuery);

    // Tab filter - using actual DB status values: pending, open, waiting, closed
    let matchesTab = false;
    switch (activeTab) {
      case 'open':
        matchesTab = ['pending', 'open'].includes(ticket.status);
        break;
      case 'pending':
        matchesTab = ticket.status === 'waiting';
        break;
      case 'closed':
        matchesTab = ticket.status === 'closed';
        break;
      case 'bot':
        matchesTab = false; // No bot flag in current schema
        break;
    }

    return matchesSearch && matchesTab;
  });

  const getTabCount = (tab: TabFilter) => {
    switch (tab) {
      case 'open':
        return tickets.filter(t => ['pending', 'open'].includes(t.status)).length;
      case 'pending':
        return tickets.filter(t => t.status === 'waiting').length;
      case 'closed':
        return tickets.filter(t => t.status === 'closed').length;
      case 'bot':
        return 0;
    }
  };

  return (
    <div className="flex h-[calc(100vh-220px)] md:h-[calc(100vh-200px)] rounded-xl overflow-hidden border-0 shadow-xl bg-card">
      {/* Sidebar - Ticket List */}
      <div className={cn(
        "flex flex-col bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-r border-border/50",
        selectedTicket ? "hidden lg:flex lg:w-[380px]" : "w-full lg:w-[380px]"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-border/50 space-y-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-10 border-border/50 hover:bg-slate-100 dark:hover:bg-slate-800 gap-2 font-medium">
              <Filter className="h-4 w-4 text-blue-500" />
              <span>Filtro</span>
            </Button>
            <Button variant="outline" size="sm" className="flex-1 h-10 border-border/50 hover:bg-slate-100 dark:hover:bg-slate-800 gap-2 font-medium">
              <Users className="h-4 w-4 text-purple-500" />
              <span>Contatos</span>
            </Button>
            <Button 
              size="icon" 
              className="h-10 w-10 bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/25"
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, telefone ou protocolo..."
              className="pl-10 h-10 bg-slate-100/80 dark:bg-slate-800/80 border-0 focus-visible:ring-green-500"
            />
          </div>
        </div>

        {/* Status Tabs */}
        <div className="border-b border-border/50 bg-white/60 dark:bg-slate-900/60">
          <div className="flex text-xs font-semibold">
            <button
              onClick={() => setActiveTab('open')}
              className={cn(
                "flex-1 py-3 px-2 border-b-2 transition-all duration-200",
                activeTab === 'open' 
                  ? "border-green-500 text-green-600 bg-green-50/50 dark:bg-green-950/30" 
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <span className="flex items-center justify-center gap-1.5">
                <span className="hidden sm:inline">ABERTOS</span>
                <span className="sm:hidden">📥</span>
                <Badge 
                  className={cn(
                    "h-5 min-w-5 text-[10px] font-bold",
                    activeTab === 'open' 
                      ? "bg-green-500 text-white hover:bg-green-500" 
                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  )}
                >
                  {getTabCount('open')}
                </Badge>
              </span>
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={cn(
                "flex-1 py-3 px-2 border-b-2 transition-all duration-200",
                activeTab === 'pending' 
                  ? "border-amber-500 text-amber-600 bg-amber-50/50 dark:bg-amber-950/30" 
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <span className="flex items-center justify-center gap-1.5">
                <span className="hidden sm:inline">PENDENTES</span>
                <span className="sm:hidden">⏳</span>
                <Badge 
                  className={cn(
                    "h-5 min-w-5 text-[10px] font-bold",
                    activeTab === 'pending' 
                      ? "bg-amber-500 text-white hover:bg-amber-500" 
                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  )}
                >
                  {getTabCount('pending')}
                </Badge>
              </span>
            </button>
            <button
              onClick={() => setActiveTab('closed')}
              className={cn(
                "flex-1 py-3 px-2 border-b-2 transition-all duration-200",
                activeTab === 'closed' 
                  ? "border-slate-500 text-slate-600 bg-slate-100/50 dark:bg-slate-800/50" 
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <span className="flex items-center justify-center gap-1.5">
                <span className="hidden sm:inline">FECHADOS</span>
                <span className="sm:hidden">✅</span>
                <Badge 
                  className={cn(
                    "h-5 min-w-5 text-[10px] font-bold",
                    activeTab === 'closed' 
                      ? "bg-slate-500 text-white hover:bg-slate-500" 
                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  )}
                >
                  {getTabCount('closed')}
                </Badge>
              </span>
            </button>
            <button
              onClick={() => setActiveTab('bot')}
              className={cn(
                "flex-1 py-3 px-2 border-b-2 transition-all duration-200",
                activeTab === 'bot' 
                  ? "border-blue-500 text-blue-600 bg-blue-50/50 dark:bg-blue-950/30" 
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <span className="flex items-center justify-center gap-1.5">
                <span className="hidden sm:inline">CHATBOT</span>
                <span className="sm:hidden">🤖</span>
                <Badge 
                  className={cn(
                    "h-5 min-w-5 text-[10px] font-bold",
                    activeTab === 'bot' 
                      ? "bg-blue-500 text-white hover:bg-blue-500" 
                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  )}
                >
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
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-green-500" />
                <span className="text-xs text-muted-foreground">Carregando tickets...</span>
              </div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground p-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mb-3">
                <MessageSquare className="h-7 w-7 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Nenhum ticket encontrado</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-1">
                Os tickets aparecerão aqui quando houver novas conversas
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
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
        <div className="flex-1 hidden lg:flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-green-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-emerald-950/10">
          <div className="text-center p-8">
            <div className="relative mx-auto mb-6">
              <div className="absolute inset-0 bg-green-500/10 rounded-full blur-2xl animate-pulse" />
              <div className="relative w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-green-500/20">
                <MessageSquare className="h-11 w-11 text-white" />
              </div>
            </div>
            <h3 className="font-bold text-xl text-foreground mb-2">Selecione uma conversa</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Escolha um ticket na lista ao lado para iniciar o atendimento
            </p>
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

  const getTimeLabel = () => {
    if (!ticket.last_message_at) return '';
    const date = new Date(ticket.last_message_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return format(date, 'HH:mm');
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays}d`;
    return format(date, 'dd/MM');
  };

  const getStatusColor = () => {
    switch (ticket.status) {
      case 'open': return 'from-green-500 to-emerald-500';
      case 'pending': return 'from-amber-500 to-orange-500';
      case 'waiting': return 'from-yellow-500 to-amber-500';
      case 'closed': return 'from-slate-400 to-slate-500';
      default: return 'from-blue-500 to-indigo-500';
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 p-4 cursor-pointer transition-all duration-200 hover:bg-gradient-to-r hover:from-green-50/50 hover:to-emerald-50/30 dark:hover:from-green-950/20 dark:hover:to-emerald-950/10",
        isSelected && "bg-gradient-to-r from-green-50 to-emerald-50/50 dark:from-green-950/30 dark:to-emerald-950/20 border-l-4 border-l-green-500"
      )}
    >
      {/* Avatar with status indicator */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-12 w-12 ring-2 ring-white dark:ring-slate-800 shadow-md">
          <AvatarImage src={ticket.contact?.profile_picture_url || undefined} />
          <AvatarFallback className={cn(
            "bg-gradient-to-br text-white font-bold text-sm",
            getStatusColor()
          )}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className={cn(
          "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white dark:border-slate-800 shadow-sm",
          ticket.status === 'closed' ? "bg-slate-400" : "bg-green-500"
        )} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm truncate text-foreground">{contactName}</h4>
              {ticket.is_bot_active && (
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Bot className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-1 leading-relaxed">
              {ticket.last_message || 'Aguardando primeira mensagem...'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className="text-[11px] font-medium text-muted-foreground">
              {getTimeLabel()}
            </span>
            {ticket.unread_count && ticket.unread_count > 0 && (
              <Badge className="h-5 min-w-5 px-1.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold text-[10px] shadow-sm">
                {ticket.unread_count > 99 ? '99+' : ticket.unread_count}
              </Badge>
            )}
          </div>
        </div>

        {/* Tags row */}
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          <Badge variant="outline" className="text-[10px] h-5 font-mono bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
            #{ticket.protocol?.replace('T', '')}
          </Badge>
          {ticket.sector && (
            <Badge 
              className="text-[10px] h-5 font-medium shadow-sm"
              style={{ 
                background: `linear-gradient(135deg, ${ticket.sector.color}20, ${ticket.sector.color}10)`, 
                color: ticket.sector.color,
                borderColor: ticket.sector.color,
                borderWidth: 1
              }}
            >
              {ticket.sector.name}
            </Badge>
          )}
          {ticket.assigned_operator && (
            <Badge className="text-[10px] h-5 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium shadow-sm">
              <User className="h-2.5 w-2.5 mr-1" />
              {ticket.assigned_operator.name.split(' ')[0]}
            </Badge>
          )}
        </div>
      </div>

      {/* Read indicator */}
      <div className="flex-shrink-0 mt-1">
        <CheckCircle2 className={cn(
          "h-4 w-4 transition-colors",
          ticket.unread_count && ticket.unread_count > 0 
            ? "text-slate-300 dark:text-slate-600" 
            : "text-green-500"
        )} />
      </div>
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
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="h-[72px] px-4 border-b border-border/50 flex items-center justify-between bg-gradient-to-r from-white via-white to-green-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/10">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden h-10 w-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" 
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="relative">
            <Avatar className="h-11 w-11 ring-2 ring-green-500/30">
              <AvatarImage src={ticket.contact?.profile_picture_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-green-500 rounded-full border-2 border-white dark:border-slate-900" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-foreground">{contactName}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="h-4 text-[10px] px-1.5 font-mono">
                {ticket.protocol}
              </Badge>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {ticket.assigned_operator?.name || 'Não atribuído'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-green-50 dark:hover:bg-green-950/30 text-muted-foreground hover:text-green-600">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/30 text-muted-foreground hover:text-blue-600">
            <Phone className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-border/50 shadow-xl">
              {!ticket.assigned_operator_id && currentOperator && (
                <DropdownMenuItem 
                  onClick={() => onAssign(currentOperator.id)}
                  className="gap-3 py-2.5"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-medium">Assumir ticket</span>
                </DropdownMenuItem>
              )}
              {ticket.assigned_operator_id === currentOperator?.id && (
                <DropdownMenuItem 
                  onClick={() => onAssign(null)}
                  className="gap-3 py-2.5"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-medium">Liberar ticket</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onStatusChange('waiting')}
                className="gap-3 py-2.5"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-white" />
                </div>
                <span className="font-medium">Aguardando cliente</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onStatusChange('closed')}
                className="gap-3 py-2.5"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
                <span className="font-medium">Finalizar ticket</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-6"
        style={{ 
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2394a3b8' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)'
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/20 rounded-full blur-lg animate-pulse" />
                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-medium">Carregando mensagens...</span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center mb-4 shadow-inner">
              <MessageSquare className="h-9 w-9 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-base font-medium text-slate-600 dark:text-slate-400">Nenhuma mensagem ainda</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center mt-1">
              As mensagens aparecerão aqui
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl mx-auto">
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
        <div className="px-4 py-3 border-t border-border/50 bg-gradient-to-r from-slate-50/80 to-orange-50/30 dark:from-slate-900/80 dark:to-orange-950/10 overflow-x-auto">
          <div className="flex gap-2">
            {quickReplies.slice(0, 8).map((qr) => (
              <Button
                key={qr.id}
                variant="outline"
                size="sm"
                className="flex-shrink-0 text-xs h-8 px-3 rounded-full bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 border-orange-200 dark:border-orange-800/50 text-orange-700 dark:text-orange-400 hover:from-orange-100 hover:to-amber-100 dark:hover:from-orange-900/40 dark:hover:to-amber-900/30 font-medium shadow-sm"
                onClick={() => handleQuickReply(qr.content)}
              >
                <Zap className="h-3 w-3 mr-1.5 text-orange-500" />
                {qr.title}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border/50 bg-gradient-to-r from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50">
        <div className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 rounded-2xl p-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-200/80 dark:hover:bg-slate-700/80 text-slate-500 hover:text-amber-500">
                <Smile className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2 bg-card border-border/50 shadow-xl">
              <p className="text-xs text-muted-foreground text-center py-4">
                Emojis em breve...
              </p>
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-200/80 dark:hover:bg-slate-700/80 text-slate-500 hover:text-blue-500">
            <Paperclip className="h-5 w-5" />
          </Button>

          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            disabled={isSending || !currentOperator}
            className="flex-1 h-10 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
          />

          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-200/80 dark:hover:bg-slate-700/80 text-slate-500 hover:text-purple-500">
            <Mic className="h-5 w-5" />
          </Button>

          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending || !currentOperator}
            size="icon"
            className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/25 disabled:opacity-50 disabled:shadow-none"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {!currentOperator && (
          <div className="flex items-center justify-center gap-2 mt-2 py-1.5 px-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
              Você precisa ser um operador para enviar mensagens
            </p>
          </div>
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
        <div className="flex justify-center my-2">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-950/50 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full text-xs font-medium shadow-sm">
            <AlertCircle className="h-3.5 w-3.5" />
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
            "max-w-[75%] md:max-w-[65%] rounded-2xl px-4 py-2.5 relative transition-all duration-200",
            isFromMe 
              ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/20 rounded-br-md" 
              : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-md rounded-bl-md border border-slate-100 dark:border-slate-700"
          )}
        >
          {/* Sender info for bot/operator messages */}
          {isFromMe && (isBot || message.sender_name) && (
            <div className="flex items-center gap-1.5 text-[11px] text-green-100 font-semibold mb-1.5">
              {isBot ? (
                <>
                  <Bot className="h-3.5 w-3.5" />
                  <span>CHATBOT</span>
                </>
              ) : (
                <>
                  <User className="h-3.5 w-3.5" />
                  <span>{message.sender_name}</span>
                </>
              )}
            </div>
          )}

          {/* Media preview */}
          {message.message_type !== 'text' && message.media_url && (
            <div className={cn(
              "flex items-center gap-2 text-sm mb-2 py-2 px-3 rounded-lg",
              isFromMe ? "bg-green-400/30" : "bg-slate-100 dark:bg-slate-700"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                isFromMe ? "bg-white/20" : "bg-slate-200 dark:bg-slate-600"
              )}>
                {getMessageIcon()}
              </div>
              <span className="font-medium">Mídia anexada</span>
            </div>
          )}

          {/* Message text */}
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {message.content}
            </p>
          )}

          {/* Timestamp */}
          <div className={cn(
            "flex items-center justify-end gap-1.5 text-[10px] mt-1.5 font-medium",
            isFromMe ? "text-green-100" : "text-slate-400"
          )}>
            {format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}
            {isFromMe && (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex justify-center my-6">
      <div className="inline-flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-4 py-2 rounded-full text-xs font-medium text-slate-600 dark:text-slate-400 shadow-md border border-slate-200/50 dark:border-slate-700/50">
        <Clock className="h-3.5 w-3.5" />
        {format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
      </div>
    </div>
  );
}
