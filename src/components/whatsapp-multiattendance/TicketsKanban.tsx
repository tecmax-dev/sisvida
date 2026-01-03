import { useState } from 'react';
import { useWhatsAppTickets, useWhatsAppOperators, useWhatsAppSectors } from '@/hooks/useWhatsAppMultiattendance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  MessageSquare, 
  Clock, 
  User, 
  MoreVertical,
  Phone,
  ArrowRight,
  Bot,
  Loader2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  TICKET_STATUS_LABELS, 
  TICKET_STATUS_COLORS,
  WhatsAppTicket,
  WhatsAppTicketStatus 
} from '@/types/whatsapp-multiattendance';
import { TicketChatDialog } from './TicketChatDialog';
import { cn } from '@/lib/utils';

interface TicketsKanbanProps {
  clinicId: string | undefined;
}

const KANBAN_COLUMNS: { status: WhatsAppTicketStatus; label: string; color: string }[] = [
  { status: 'pending', label: 'Pendentes', color: '#EF4444' },
  { status: 'open', label: 'Em Atendimento', color: '#3B82F6' },
  { status: 'waiting', label: 'Aguardando Cliente', color: '#F59E0B' },
];

export function TicketsKanban({ clinicId }: TicketsKanbanProps) {
  const { tickets, isLoading, updateTicketStatus, assignTicket } = useWhatsAppTickets(clinicId);
  const { operators, currentOperator } = useWhatsAppOperators(clinicId);
  const { sectors } = useWhatsAppSectors(clinicId);
  const [selectedTicket, setSelectedTicket] = useState<WhatsAppTicket | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getTicketsByStatus = (status: WhatsAppTicketStatus) => 
    tickets.filter(t => t.status === status);

  const handleAssignToMe = async (ticket: WhatsAppTicket) => {
    if (!currentOperator) return;
    await assignTicket(ticket.id, currentOperator.id);
  };

  const handleRelease = async (ticket: WhatsAppTicket) => {
    await assignTicket(ticket.id, null);
  };

  const handleChangeStatus = async (ticket: WhatsAppTicket, status: WhatsAppTicketStatus) => {
    await updateTicketStatus(ticket.id, status);
  };

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((column) => {
          const columnTickets = getTicketsByStatus(column.status);
          
          return (
            <div 
              key={column.status}
              className="flex-shrink-0 w-80"
            >
              <Card className="h-full">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: column.color }}
                      />
                      <CardTitle className="text-sm font-medium">
                        {column.label}
                      </CardTitle>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {columnTickets.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-2">
                  <ScrollArea className="h-[calc(100vh-280px)]">
                    <div className="space-y-2 pr-2">
                      {columnTickets.length === 0 ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                          Nenhum ticket
                        </div>
                      ) : (
                        columnTickets.map((ticket) => (
                          <TicketCard
                            key={ticket.id}
                            ticket={ticket}
                            currentOperatorId={currentOperator?.id}
                            onOpen={() => setSelectedTicket(ticket)}
                            onAssignToMe={() => handleAssignToMe(ticket)}
                            onRelease={() => handleRelease(ticket)}
                            onChangeStatus={(status) => handleChangeStatus(ticket, status)}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      <TicketChatDialog
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        clinicId={clinicId}
      />
    </>
  );
}

interface TicketCardProps {
  ticket: WhatsAppTicket;
  currentOperatorId: string | undefined;
  onOpen: () => void;
  onAssignToMe: () => void;
  onRelease: () => void;
  onChangeStatus: (status: WhatsAppTicketStatus) => void;
}

function TicketCard({ 
  ticket, 
  currentOperatorId,
  onOpen, 
  onAssignToMe, 
  onRelease,
  onChangeStatus 
}: TicketCardProps) {
  const isAssignedToMe = ticket.assigned_operator_id === currentOperatorId;
  const contactName = ticket.contact?.name || ticket.contact?.phone || 'Contato';
  const initials = contactName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-md transition-shadow",
        isAssignedToMe && "ring-2 ring-primary/50"
      )}
      onClick={onOpen}
    >
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={ticket.contact?.profile_picture_url || undefined} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium line-clamp-1">{contactName}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {ticket.contact?.phone}
              </p>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!ticket.assigned_operator_id && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAssignToMe(); }}>
                  <User className="h-4 w-4 mr-2" />
                  Assumir
                </DropdownMenuItem>
              )}
              {isAssignedToMe && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRelease(); }}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Liberar
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {ticket.status !== 'waiting' && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onChangeStatus('waiting'); }}>
                  Aguardando Cliente
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onChangeStatus('closed'); }}
                className="text-destructive"
              >
                Finalizar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Protocol & Sector */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs font-mono">
            {ticket.protocol}
          </Badge>
          {ticket.sector && (
            <Badge 
              variant="secondary" 
              className="text-xs"
              style={{ backgroundColor: `${ticket.sector.color}20`, color: ticket.sector.color }}
            >
              {ticket.sector.name}
            </Badge>
          )}
          {ticket.is_bot_active && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Bot className="h-3 w-3" />
              IA
            </Badge>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {ticket.last_message_at 
              ? formatDistanceToNow(new Date(ticket.last_message_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                })
              : 'Sem mensagens'
            }
          </div>
          {ticket.assigned_operator && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {ticket.assigned_operator.name.split(' ')[0]}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
