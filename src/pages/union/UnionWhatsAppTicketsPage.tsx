import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  Search,
  RefreshCw,
  Phone,
  User,
  Inbox,
  Zap,
  MessageSquarePlus,
  Bot,
  LayoutList,
  Columns3,
  Users,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  useWhazingTickets,
  useWhazingTicketStats,
  useWhazingRealtimeSubscription,
  closeWhazingTicket,
  type WhazingTicket,
} from "@/hooks/useWhazingTickets";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import InlineChatPanel from "@/components/union/whazing/InlineChatPanel";
import TicketKanban from "@/components/union/whazing/TicketKanban";
import QueueUsersManager from "@/components/union/whazing/QueueUsersManager";
import QuickResponsesManager from "@/components/union/whazing/QuickResponsesManager";
import NewChatContactList from "@/components/union/whazing/NewChatContactList";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { useContactProfilePics } from "@/hooks/useContactProfilePics";
import { ContactAvatar } from "@/components/union/whazing/ContactAvatar";

function formatPhone(phone: string) {
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 13 && clean.startsWith("55")) {
    const ddd = clean.slice(2, 4);
    const num = clean.slice(4);
    return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
  }
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  return phone;
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d`;
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch { /* ignore audio errors */ }
}

const statusConfig: Record<string, { label: string; color: string; dotColor: string }> = {
  open: { label: "Aberto", color: "text-emerald-700", dotColor: "bg-emerald-500" },
  pending: { label: "Pendente", color: "text-amber-700", dotColor: "bg-amber-500" },
  closed: { label: "Fechado", color: "text-muted-foreground", dotColor: "bg-muted-foreground" },
};

export default function UnionWhatsAppTicketsPage() {
  const [statusFilter, setStatusFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<WhazingTicket | null>(null);
  const [quickResponsesOpen, setQuickResponsesOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClosingAll, setIsClosingAll] = useState(false);
  const prevPendingRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

  const { data: tickets, isLoading, refetch, isFetching } = useWhazingTickets(statusFilter);
  const { data: stats } = useWhazingTicketStats();

  useWhazingRealtimeSubscription();
  const { getProfilePic } = useContactProfilePics();

  useEffect(() => {
    if (!stats) return;
    const currentPending = stats.open + stats.pending;
    if (prevPendingRef.current !== null && currentPending > prevPendingRef.current) {
      playNotificationSound();
    }
    prevPendingRef.current = currentPending;
  }, [stats]);

  const filtered = (tickets || []).filter((t) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (t.contact_name || "").toLowerCase().includes(s) ||
      t.contact_number.includes(s) ||
      (t.subject || "").toLowerCase().includes(s) ||
      t.ticket_id.toLowerCase().includes(s) ||
      String(t.ticket_number ?? "").includes(s)
    );
  });

  const handleOpenChat = (ticket: WhazingTicket) => {
    setSelectedTicket(ticket);
  };

  const handleSyncContacts = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('whazing-actions', {
        body: { action: 'sync_contact_names' },
      });
      if (error) throw error;
      toast.success(`Nomes sincronizados: ${data?.updated || 0} tickets atualizados`);
      refetch();
    } catch (err: any) {
      toast.error('Erro ao sincronizar nomes: ' + (err.message || 'erro desconhecido'));
    } finally {
      setIsSyncing(false);
    }
  }, [refetch]);

  const handleCloseAllTickets = useCallback(async () => {
    const openTickets = (tickets || []).filter(t => t.status === "open" || t.status === "pending");
    if (openTickets.length === 0) {
      toast.info("Nenhum ticket aberto ou pendente para fechar.");
      return;
    }
    const confirmed = window.confirm(`Deseja fechar ${openTickets.length} ticket(s) aberto(s)/pendente(s)?`);
    if (!confirmed) return;

    setIsClosingAll(true);
    let closed = 0;
    let errors = 0;
    for (const ticket of openTickets) {
      try {
        await closeWhazingTicket(ticket.ticket_id, ticket.contact_number);
        closed++;
      } catch {
        errors++;
      }
    }
    queryClient.invalidateQueries({ queryKey: ["whazing-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["whazing-ticket-stats"] });
    setIsClosingAll(false);
    if (errors > 0) {
      toast.warning(`${closed} ticket(s) fechado(s), ${errors} erro(s).`);
    } else {
      toast.success(`${closed} ticket(s) fechado(s) com sucesso!`);
    }
  }, [tickets, queryClient]);

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Atendimento WhatsApp</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2 rounded-r-none"
              onClick={() => setViewMode("list")}
              title="Lista"
            >
              <LayoutList className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2 rounded-l-none"
              onClick={() => setViewMode("kanban")}
              title="Kanban"
            >
              <Columns3 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button size="sm" onClick={() => setNewChatOpen(true)}>
            <MessageSquarePlus className="h-4 w-4 mr-1" />
            Novo Chat
          </Button>
          <Button variant="outline" size="sm" onClick={() => setQuickResponsesOpen(true)}>
            <Zap className="h-4 w-4 mr-1" />
            Respostas Rápidas
          </Button>
          <QueueUsersManager />
          <Button variant="outline" size="sm" onClick={handleSyncContacts} disabled={isSyncing} title="Sincronizar nomes dos contatos via Evolution API">
            <Users className={`h-4 w-4 mr-1 ${isSyncing ? "animate-spin" : ""}`} />
            Sync Nomes
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === "kanban" ? (
        <div className="flex-1 overflow-hidden border rounded-lg bg-card p-4">
          <TicketKanban
            tickets={tickets || []}
            onSelectTicket={handleOpenChat}
            getProfilePic={getProfilePic}
          />
        </div>
      ) : (
      /* Split Layout */
      <div className="flex-1 border rounded-lg overflow-hidden bg-card">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel - Ticket List */}
          <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
            <div className="flex flex-col h-full">
              {/* Tabs */}
              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="flex flex-col h-full">
                <div className="border-b px-2 pt-2">
                  <TabsList className="bg-transparent h-auto p-0 w-full justify-start gap-0">
                    <TabsTrigger
                      value="open"
                      className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-700 data-[state=active]:shadow-none rounded-none pb-2.5 px-3 uppercase text-[11px] font-semibold tracking-wide"
                    >
                      Abertos
                      {(stats?.open ?? 0) > 0 && (
                        <Badge variant="secondary" className="ml-1 h-4 min-w-4 text-[9px] px-1 bg-emerald-100 text-emerald-700">
                          {stats?.open}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="pending"
                      className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-amber-500 data-[state=active]:text-amber-700 data-[state=active]:shadow-none rounded-none pb-2.5 px-3 uppercase text-[11px] font-semibold tracking-wide"
                    >
                      Pendentes
                      {(stats?.pending ?? 0) > 0 && (
                        <Badge variant="secondary" className="ml-1 h-4 min-w-4 text-[9px] px-1 bg-amber-100 text-amber-700">
                          {stats?.pending}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="closed"
                      className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-muted-foreground data-[state=active]:shadow-none rounded-none pb-2.5 px-3 uppercase text-[11px] font-semibold tracking-wide"
                    >
                      Fechados
                    </TabsTrigger>
                    <TabsTrigger
                      value="chatbot"
                      className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-700 data-[state=active]:shadow-none rounded-none pb-2.5 px-3 uppercase text-[11px] font-semibold tracking-wide"
                    >
                      <Bot className="h-3.5 w-3.5 mr-1" />
                      Chatbot
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Search */}
                <div className="px-3 py-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar contato..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Ticket List */}
                <TabsContent value={statusFilter} className="m-0 flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    {isLoading ? (
                      <div className="p-3 space-y-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Skeleton key={i} className="h-16 w-full rounded-lg" />
                        ))}
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <Inbox className="h-10 w-10 mb-2 opacity-20" />
                        <p className="text-sm font-medium">Nenhum ticket</p>
                        <p className="text-xs">{search ? "Tente outro filtro" : "Sem tickets neste status"}</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {filtered.map((ticket) => {
                          const isSelected = selectedTicket?.id === ticket.id;
                          const cfg = statusConfig[ticket.status] || statusConfig.pending;
                          return (
                            <button
                              key={ticket.id}
                              className={cn(
                                "w-full text-left px-3 py-3 hover:bg-accent/50 transition-colors flex items-start gap-3",
                                isSelected && "bg-accent"
                              )}
                              onClick={() => handleOpenChat(ticket)}
                            >
                              <ContactAvatar
                                profilePicUrl={getProfilePic(ticket.contact_number)}
                                name={ticket.contact_name}
                              >
                                <span className={cn("absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card", cfg.dotColor)} />
                              </ContactAvatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1 min-w-0">
                                    <span className="text-sm font-medium truncate">
                                      {ticket.contact_name || "Desconhecido"}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">#{ticket.ticket_number ?? '—'}</span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                    {timeAgo(ticket.opened_at)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Phone className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{formatPhone(ticket.contact_number)}</span>
                                </div>
                                {ticket.last_message && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {ticket.last_message.slice(0, 50)}
                                  </p>
                                )}
                                <div className="flex items-center gap-1 mt-1">
                                  {ticket.bot_active && (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1 bg-blue-50 text-blue-600 border-blue-200">
                                      <Bot className="h-2.5 w-2.5 mr-0.5" />
                                      IA
                                    </Badge>
                                  )}
                                  {ticket.holiday_notified && (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1 bg-blue-50 text-blue-600 border-blue-200">
                                      🔔
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Chat */}
          <ResizablePanel defaultSize={65}>
            <InlineChatPanel
              ticket={selectedTicket}
              onClose={() => setSelectedTicket(null)}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      )}


      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5" />
              Novo Chat
            </DialogTitle>
          </DialogHeader>
          <NewChatContactList
            onStartChat={(ticket) => {
              setNewChatOpen(false);
              setSelectedTicket(ticket);
              refetch();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={quickResponsesOpen} onOpenChange={setQuickResponsesOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Respostas Rápidas</DialogTitle>
          </DialogHeader>
          <QuickResponsesManager />
        </DialogContent>
      </Dialog>
    </div>
  );
}
