import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  Search,
  RefreshCw,
  Phone,
  User,
  Inbox,
  ExternalLink,
  LayoutGrid,
  List,
  Zap,
  Settings,
  MessageSquarePlus,
} from "lucide-react";
import {
  useWhazingTickets,
  useWhazingTicketStats,
  useWhazingRealtimeSubscription,
  type WhazingTicket,
} from "@/hooks/useWhazingTickets";
import { Skeleton } from "@/components/ui/skeleton";
import WhazingChatPanel from "@/components/union/WhazingChatPanel";
import TicketKanban from "@/components/union/whazing/TicketKanban";
import QuickResponsesManager from "@/components/union/whazing/QuickResponsesManager";
import NewChatContactList from "@/components/union/whazing/NewChatContactList";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open: {
    label: "Aberto",
    color: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
    icon: <MessageSquare className="h-3.5 w-3.5" />,
  },
  pending: {
    label: "Pendente",
    color: "bg-amber-500/15 text-amber-700 border-amber-300",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  closed: {
    label: "Fechado",
    color: "bg-muted text-muted-foreground border-border",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
};

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

export default function UnionWhatsAppTicketsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<WhazingTicket | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [quickResponsesOpen, setQuickResponsesOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const prevPendingRef = useRef<number | null>(null);

  const { data: tickets, isLoading, refetch, isFetching } = useWhazingTickets(statusFilter);
  const allTicketsQuery = useWhazingTickets("all");
  const { data: stats } = useWhazingTicketStats();

  useWhazingRealtimeSubscription();

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
      t.ticket_id.toLowerCase().includes(s)
    );
  });

  const handleOpenChat = (ticket: WhazingTicket) => {
    setSelectedTicket(ticket);
    setChatOpen(true);
  };

  const kanbanTickets = (allTicketsQuery.data || []).filter((t) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (t.contact_name || "").toLowerCase().includes(s) ||
      t.contact_number.includes(s) ||
      (t.subject || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Atendimento WhatsApp
          </h1>
          <p className="text-muted-foreground text-sm">
            Gerencie os tickets de atendimento via WhatsApp
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setNewChatOpen(true)}
          >
            <MessageSquarePlus className="h-4 w-4 mr-1" />
            Novo Chat
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickResponsesOpen(true)}
          >
            <Zap className="h-4 w-4 mr-1" />
            Respostas Rápidas
          </Button>
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-r-none h-8"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-l-none h-8"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats?.total ?? "-"}</p>
              </div>
              <Inbox className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Abertos</p>
                <p className="text-2xl font-bold text-emerald-600">{stats?.open ?? "-"}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-amber-600">{stats?.pending ?? "-"}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Fechados</p>
                <p className="text-2xl font-bold text-muted-foreground">{stats?.closed ?? "-"}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search bar for kanban */}
      {viewMode === "kanban" && (
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, assunto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      )}

      {/* Kanban View */}
      {viewMode === "kanban" ? (
        <TicketKanban tickets={kanbanTickets} onSelectTicket={handleOpenChat} />
      ) : (
        /* List View */
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="text-lg">Tickets</CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, telefone, assunto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <div className="px-6 border-b">
                <TabsList className="bg-transparent h-auto p-0 gap-4">
                  <TabsTrigger value="all" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 px-1">
                    Todos
                  </TabsTrigger>
                  <TabsTrigger value="open" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none pb-3 px-1">
                    Abertos
                    {(stats?.open ?? 0) > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-5 text-[10px] bg-emerald-100 text-emerald-700">
                        {stats?.open}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none pb-3 px-1">
                    Pendentes
                    {(stats?.pending ?? 0) > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-5 text-[10px] bg-amber-100 text-amber-700">
                        {stats?.pending}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="closed" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-muted-foreground rounded-none pb-3 px-1">
                    Fechados
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value={statusFilter} className="m-0">
                {isLoading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Inbox className="h-12 w-12 mb-3 opacity-30" />
                    <p className="font-medium">Nenhum ticket encontrado</p>
                    <p className="text-sm">
                      {search
                        ? "Tente alterar os filtros de busca"
                        : "Os tickets aparecerão aqui quando forem recebidos via webhook"}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">#</TableHead>
                          <TableHead>Contato</TableHead>
                          <TableHead className="hidden md:table-cell">Última Msg</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden sm:table-cell">Aberto há</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((ticket) => {
                          const cfg = statusConfig[ticket.status] || statusConfig.pending;
                          return (
                            <TableRow
                              key={ticket.id}
                              className="hover:bg-muted/50 cursor-pointer"
                              onClick={() => handleOpenChat(ticket)}
                            >
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {ticket.ticket_id.length > 8
                                  ? ticket.ticket_id.slice(0, 8)
                                  : ticket.ticket_id}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-sm flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                    {ticket.contact_name || "Desconhecido"}
                                  </span>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {formatPhone(ticket.contact_number)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                                {ticket.last_message
                                  ? ticket.last_message.slice(0, 60) + (ticket.last_message.length > 60 ? "..." : "")
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`gap-1 text-[11px] ${cfg.color}`}>
                                  {cfg.icon}
                                  {cfg.label}
                                </Badge>
                                {ticket.holiday_notified && (
                                  <Badge variant="outline" className="ml-1 text-[10px] bg-blue-50 text-blue-600 border-blue-200">
                                    🔔
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                                {timeAgo(ticket.opened_at)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenChat(ticket);
                                  }}
                                >
                                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                  Abrir
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Chat Panel */}
      <WhazingChatPanel
        ticket={selectedTicket}
        open={chatOpen}
        onClose={() => {
          setChatOpen(false);
          setSelectedTicket(null);
        }}
      />

      {/* Quick Responses Dialog */}
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
