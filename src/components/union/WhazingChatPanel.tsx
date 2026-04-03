import { useState, useRef, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Send,
  Phone,
  User,
  Clock,
  X,
  ArrowRightLeft,
  Loader2,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import {
  useWhazingMessages,
  sendWhazingMessage,
  closeWhazingTicket,
  type WhazingTicket,
} from "@/hooks/useWhazingTickets";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import QuickResponsePicker from "@/components/union/whazing/QuickResponsePicker";
import TicketTagsManager from "@/components/union/whazing/TicketTagsManager";
import TransferQueueDialog from "@/components/union/whazing/TransferQueueDialog";

interface WhazingChatPanelProps {
  ticket: WhazingTicket | null;
  open: boolean;
  onClose: () => void;
}

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

function formatTimestamp(ts: number | null) {
  if (!ts) return "";
  const date = new Date(ts * 1000);
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function WhazingChatPanel({ ticket, open, onClose }: WhazingChatPanelProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useWhazingMessages(ticket?.ticket_id ?? null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !ticket) return;
    setSending(true);
    try {
      await sendWhazingMessage(ticket.ticket_id, message.trim(), ticket.contact_number);
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["whazing-messages", ticket.ticket_id] });
      toast.success("Mensagem enviada");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || "Erro desconhecido"));
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    if (!ticket) return;
    setClosing(true);
    try {
      await closeWhazingTicket(ticket.ticket_id);
      queryClient.invalidateQueries({ queryKey: ["whazing-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["whazing-ticket-stats"] });
      toast.success("Ticket fechado");
      onClose();
    } catch (err: any) {
      toast.error("Erro ao fechar: " + (err.message || "Erro desconhecido"));
    } finally {
      setClosing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickResponse = (body: string) => {
    setMessage(body);
  };

  const statusLabel: Record<string, string> = {
    open: "Aberto",
    pending: "Pendente",
    closed: "Fechado",
  };

  const statusColor: Record<string, string> = {
    open: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
    pending: "bg-amber-500/15 text-amber-700 border-amber-300",
    closed: "bg-muted text-muted-foreground border-border",
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
          {/* Header */}
          <SheetHeader className="px-4 py-3 border-b space-y-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-sm font-semibold truncate">
                    {ticket?.contact_name || "Desconhecido"}
                  </SheetTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{ticket?.contact_number ? formatPhone(ticket.contact_number) : "-"}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[10px] ${statusColor[ticket?.status || "pending"]}`}>
                  {statusLabel[ticket?.status || "pending"] || ticket?.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground font-mono">
                  #{ticket?.ticket_id}
                </span>
              </div>
            </div>
            {/* Tags row */}
            {ticket && (
              <div className="mt-2">
                <TicketTagsManager ticketId={ticket.ticket_id} />
              </div>
            )}
          </SheetHeader>

          {/* Messages */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div ref={scrollRef} className="p-4 space-y-3">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !messages?.length ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma mensagem registrada</p>
                    <p className="text-xs mt-1">As mensagens aparecerão aqui em tempo real</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.from_me ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                          msg.from_me
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        }`}
                      >
                        {!msg.from_me && (
                          <p className={`text-[10px] font-medium mb-0.5 ${
                            msg.from_me ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}>
                            {msg.sender_name || "Contato"}
                          </p>
                        )}
                        {msg.media_type && msg.media_url && (
                          <div className="mb-1">
                            {msg.media_type.startsWith("image") ? (
                              <ImageIcon className="h-4 w-4 inline mr-1" />
                            ) : (
                              <FileText className="h-4 w-4 inline mr-1" />
                            )}
                            <a
                              href={msg.media_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs underline"
                            >
                              {msg.media_type}
                            </a>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap break-words">{msg.body || "[mídia]"}</p>
                        <p className={`text-[10px] mt-1 text-right ${
                          msg.from_me ? "text-primary-foreground/60" : "text-muted-foreground/60"
                        }`}>
                          {formatTimestamp(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Quick Actions */}
          {ticket?.status !== "closed" && (
            <>
              <Separator />
              <div className="px-4 py-2 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-destructive hover:text-destructive"
                  onClick={handleClose}
                  disabled={closing}
                >
                  {closing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}
                  Fechar Ticket
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setTransferOpen(true)}
                >
                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                  Transferir
                </Button>
              </div>
            </>
          )}

          {/* Input */}
          {ticket?.status !== "closed" && (
            <div className="border-t px-4 py-3">
              <div className="flex items-center gap-2">
                <QuickResponsePicker onSelect={handleQuickResponse} />
                <Input
                  placeholder="Digite sua mensagem..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                  disabled={sending}
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!message.trim() || sending}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Transfer Dialog */}
      {ticket && (
        <TransferQueueDialog
          ticketId={ticket.ticket_id}
          currentQueueId={(ticket as any).assigned_queue_id}
          open={transferOpen}
          onOpenChange={setTransferOpen}
        />
      )}
    </>
  );
}
