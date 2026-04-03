import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Clock, CheckCircle2, User, Phone } from "lucide-react";
import type { WhazingTicket } from "@/hooks/useWhazingTickets";

interface TicketKanbanProps {
  tickets: WhazingTicket[];
  onSelectTicket: (ticket: WhazingTicket) => void;
}

const columns = [
  { key: "open", label: "Abertos", icon: <MessageSquare className="h-4 w-4" />, color: "text-emerald-600", borderColor: "border-t-emerald-500" },
  { key: "pending", label: "Pendentes", icon: <Clock className="h-4 w-4" />, color: "text-amber-600", borderColor: "border-t-amber-500" },
  { key: "closed", label: "Fechados", icon: <CheckCircle2 className="h-4 w-4" />, color: "text-muted-foreground", borderColor: "border-t-muted-foreground" },
];

function formatPhone(phone: string) {
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 13 && clean.startsWith("55")) {
    const ddd = clean.slice(2, 4);
    const num = clean.slice(4);
    return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
  }
  if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  return phone;
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.floor(diffH / 24)}d`;
}

export default function TicketKanban({ tickets, onSelectTicket }: TicketKanbanProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {columns.map((col) => {
        const colTickets = tickets.filter((t) => t.status === col.key);
        return (
          <div key={col.key} className="flex flex-col">
            <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${col.borderColor}`}>
              <span className={col.color}>{col.icon}</span>
              <h3 className={`font-semibold text-sm ${col.color}`}>{col.label}</h3>
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {colTickets.length}
              </Badge>
            </div>
            <ScrollArea className="flex-1 max-h-[60vh]">
              <div className="space-y-2 pr-2">
                {colTickets.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Nenhum ticket</p>
                ) : (
                  colTickets.map((ticket) => (
                    <Card
                      key={ticket.id}
                      className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => onSelectTicket(ticket)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-medium truncate">
                            {ticket.contact_name || "Desconhecido"}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {timeAgo(ticket.updated_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
                        <Phone className="h-3 w-3" />
                        {formatPhone(ticket.contact_number)}
                      </div>
                      {ticket.last_message && (
                        <p className="text-xs text-muted-foreground truncate">
                          {ticket.last_message}
                        </p>
                      )}
                      {ticket.subject && (
                        <Badge variant="outline" className="text-[9px] mt-1.5">
                          {ticket.subject}
                        </Badge>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
