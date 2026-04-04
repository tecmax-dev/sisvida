import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Clock, CheckCircle2, User, Phone, GripVertical } from "lucide-react";
import { ContactAvatar } from "@/components/union/whazing/ContactAvatar";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { WhazingTicket } from "@/hooks/useWhazingTickets";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { closeWhazingTicket, reopenWhazingTicket } from "@/hooks/useWhazingTickets";

interface TicketKanbanProps {
  tickets: WhazingTicket[];
  onSelectTicket: (ticket: WhazingTicket) => void;
  getProfilePic?: (phone: string) => string | null;
}

const columns = [
  { key: "open", label: "Abertos", icon: <MessageSquare className="h-4 w-4" />, color: "text-emerald-600", bgColor: "bg-emerald-500", borderColor: "border-t-emerald-500" },
  { key: "pending", label: "Pendentes", icon: <Clock className="h-4 w-4" />, color: "text-amber-600", bgColor: "bg-amber-500", borderColor: "border-t-amber-500" },
  { key: "closed", label: "Fechados", icon: <CheckCircle2 className="h-4 w-4" />, color: "text-muted-foreground", bgColor: "bg-muted-foreground", borderColor: "border-t-muted-foreground" },
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

// Droppable column wrapper
function KanbanColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-[200px] rounded-lg transition-colors duration-200 ${
        isOver ? "bg-accent/50 ring-2 ring-primary/30" : ""
      }`}
    >
      {children}
    </div>
  );
}

// Draggable ticket card
function SortableTicketCard({
  ticket,
  onSelectTicket,
  profilePicUrl,
}: {
  ticket: WhazingTicket;
  onSelectTicket: (ticket: WhazingTicket) => void;
  profilePicUrl?: string | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id, data: { ticket } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? "shadow-lg ring-2 ring-primary/40" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0" onClick={() => onSelectTicket(ticket)}>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <ContactAvatar profilePicUrl={profilePicUrl || null} name={ticket.contact_name} size="sm" />
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
          {!ticket.bot_active && (
            <Badge variant="secondary" className="text-[9px] mt-1 ml-1 bg-orange-100 text-orange-700">
              Atendente
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

// Overlay card shown while dragging
function TicketOverlayCard({ ticket }: { ticket: WhazingTicket }) {
  return (
    <Card className="p-3 shadow-xl ring-2 ring-primary/40 w-[300px]">
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium truncate">
              {ticket.contact_name || "Desconhecido"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            {formatPhone(ticket.contact_number)}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function TicketKanban({ tickets, onSelectTicket, getProfilePic }: TicketKanbanProps) {
  const [activeTicket, setActiveTicket] = useState<WhazingTicket | null>(null);
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const ticket = tickets.find((t) => t.id === event.active.id);
    setActiveTicket(ticket || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTicket(null);
    const { active, over } = event;
    if (!over) return;

    const ticket = tickets.find((t) => t.id === active.id);
    if (!ticket) return;

    // Determine target column
    let targetStatus: string | null = null;
    // Check if dropped on a column directly
    if (columns.some((c) => c.key === over.id)) {
      targetStatus = over.id as string;
    } else {
      // Dropped on another ticket — find its column
      const overTicket = tickets.find((t) => t.id === over.id);
      if (overTicket) targetStatus = overTicket.status;
    }

    if (!targetStatus || targetStatus === ticket.status) return;

    const statusLabels: Record<string, string> = {
      open: "Aberto",
      pending: "Pendente",
      closed: "Fechado",
    };

    try {
      if (targetStatus === "closed") {
        await closeWhazingTicket(ticket.ticket_id, ticket.contact_number);
      } else {
        await reopenWhazingTicket(ticket.ticket_id, ticket.contact_number);
      }

      queryClient.invalidateQueries({ queryKey: ["whazing-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["whazing-ticket-stats"] });
      toast.success(`Ticket movido para ${statusLabels[targetStatus] || targetStatus}`);
    } catch (err) {
      console.error("Error moving ticket:", err);
      toast.error("Erro ao mover ticket");
    }
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Can be used for visual feedback if needed
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => {
          const colTickets = tickets.filter((t) => t.status === col.key);
          return (
            <KanbanColumn key={col.key} id={col.key}>
              <div className="flex flex-col h-full">
                <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${col.borderColor}`}>
                  <span className={col.color}>{col.icon}</span>
                  <h3 className={`font-semibold text-sm ${col.color}`}>{col.label}</h3>
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {colTickets.length}
                  </Badge>
                </div>
                <ScrollArea className="flex-1 max-h-[60vh]">
                  <SortableContext
                    items={colTickets.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2 pr-2 min-h-[100px]">
                      {colTickets.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          Arraste tickets para cá
                        </p>
                      ) : (
                        colTickets.map((ticket) => (
                          <SortableTicketCard
                            key={ticket.id}
                            ticket={ticket}
                            onSelectTicket={onSelectTicket}
                            profilePicUrl={getProfilePic?.(ticket.contact_number)}
                          />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </ScrollArea>
              </div>
            </KanbanColumn>
          );
        })}
      </div>

      <DragOverlay>
        {activeTicket ? <TicketOverlayCard ticket={activeTicket} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
