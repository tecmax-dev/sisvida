import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { extractFunctionsErrorAsync } from "@/lib/functionsError";
import {
  Inbox, Send, Star, Trash2, RefreshCw, Reply, Search, Mail, MailOpen,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Msg = {
  id: string;
  from_email: string;
  from_name: string | null;
  to_email: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  snippet: string | null;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  folder: string;
  has_attachments: boolean;
  thread_key: string | null;
  campaign_id: string | null;
};

export default function UnionEmailInboxPage() {
  const [folder, setFolder] = useState<"inbox" | "starred" | "sent" | "trash">("inbox");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [selected, setSelected] = useState<Msg | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyHtml, setReplyHtml] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("email_inbox_messages")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(200);

    if (folder === "inbox") q = q.eq("folder", "inbox");
    else if (folder === "sent") q = q.eq("folder", "sent");
    else if (folder === "trash") q = q.eq("folder", "trash");
    else if (folder === "starred") q = q.eq("is_starred", true);

    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setMessages((data || []) as Msg[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [folder]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("email_inbox_messages_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "email_inbox_messages" },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [folder]);

  const filtered = useMemo(() => {
    if (!search.trim()) return messages;
    const s = search.toLowerCase();
    return messages.filter(m =>
      (m.subject || "").toLowerCase().includes(s) ||
      (m.from_email || "").toLowerCase().includes(s) ||
      (m.from_name || "").toLowerCase().includes(s) ||
      (m.snippet || "").toLowerCase().includes(s),
    );
  }, [messages, search]);

  const unreadCount = messages.filter(m => !m.is_read && m.folder === "inbox").length;

  const openMsg = async (m: Msg) => {
    setSelected(m);
    if (!m.is_read) {
      await supabase.from("email_inbox_messages").update({ is_read: true }).eq("id", m.id);
      setMessages(prev => prev.map(x => x.id === m.id ? { ...x, is_read: true } : x));
    }
  };

  const toggleStar = async (m: Msg) => {
    const val = !m.is_starred;
    await supabase.from("email_inbox_messages").update({ is_starred: val }).eq("id", m.id);
    setMessages(prev => prev.map(x => x.id === m.id ? { ...x, is_starred: val } : x));
    if (selected?.id === m.id) setSelected({ ...m, is_starred: val });
  };

  const moveToTrash = async (m: Msg) => {
    await supabase.from("email_inbox_messages").update({ folder: "trash" }).eq("id", m.id);
    toast.success("Movido para a lixeira");
    setSelected(null);
    load();
  };

  const fetchNow = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke("imap-fetch-replies");
      if (error) {
        const ex = await extractFunctionsErrorAsync(error);
        throw new Error(ex.message);
      }
      if (data && data.ok === false) {
        throw new Error(data.error || "Falha ao sincronizar");
      }
      toast.success(`Sincronizado: ${data?.imported || 0} nova(s) mensagem(ns)`);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao sincronizar");
    } finally {
      setFetching(false);
    }
  };

  const openReply = () => {
    if (!selected) return;
    const subj = selected.subject || "";
    setReplySubject(subj.toLowerCase().startsWith("re:") ? subj : `Re: ${subj}`);
    setReplyHtml("");
    setReplyOpen(true);
  };

  const sendReply = async () => {
    if (!selected) return;
    setSending(true);
    try {
      const quoted = `<br/><br/><blockquote style="border-left:3px solid #ccc;padding-left:10px;color:#666;">
        Em ${format(new Date(selected.received_at), "dd/MM/yyyy HH:mm", { locale: ptBR })},
        ${selected.from_name || selected.from_email} escreveu:<br/>
        ${selected.body_html || (selected.body_text || "").replace(/\n/g, "<br/>")}
      </blockquote>`;
      const { error } = await supabase.functions.invoke("email-inbox-send-reply", {
        body: {
          message_id: selected.id,
          to: selected.from_email,
          subject: replySubject,
          html: replyHtml + quoted,
        },
      });
      if (error) throw error;
      toast.success("Resposta enviada!");
      setReplyOpen(false);
      setReplyHtml("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao enviar resposta");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="h-6 w-6" /> Caixa de Entrada
          </h1>
          <p className="text-sm text-muted-foreground">
            Respostas recebidas em <strong>respostas@prosinge.com.br</strong>
          </p>
        </div>
        <Button onClick={fetchNow} disabled={fetching} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${fetching ? "animate-spin" : ""}`} />
          Sincronizar agora
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <Tabs value={folder} onValueChange={(v) => { setFolder(v as any); setSelected(null); }}>
        <TabsList>
          <TabsTrigger value="inbox" className="gap-2">
            <Inbox className="h-4 w-4" /> Entrada
            {unreadCount > 0 && <Badge variant="default">{unreadCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="starred" className="gap-2"><Star className="h-4 w-4" /> Com estrela</TabsTrigger>
          <TabsTrigger value="sent" className="gap-2"><Send className="h-4 w-4" /> Enviadas</TabsTrigger>
          <TabsTrigger value="trash" className="gap-2"><Trash2 className="h-4 w-4" /> Lixeira</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Lista */}
        <Card className="w-[380px] flex-shrink-0 overflow-hidden">
          <ScrollArea className="h-full">
            {loading && <div className="p-4 text-sm text-muted-foreground">Carregando...</div>}
            {!loading && filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Mail className="h-10 w-10 mx-auto mb-2 opacity-30" />
                Nenhuma mensagem
              </div>
            )}
            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => openMsg(m)}
                className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${
                  selected?.id === m.id ? "bg-muted" : ""
                } ${!m.is_read ? "font-semibold" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate">{m.from_name || m.from_email}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(m.received_at), "dd/MM HH:mm")}
                  </span>
                </div>
                <div className="text-sm truncate">{m.subject || "(sem assunto)"}</div>
                <div className="text-xs text-muted-foreground truncate">{m.snippet}</div>
                <div className="flex items-center gap-2 mt-1">
                  {m.is_starred && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
                  {!m.is_read && <span className="h-2 w-2 rounded-full bg-primary" />}
                  {m.campaign_id && <Badge variant="outline" className="text-[10px] px-1 py-0">Campanha</Badge>}
                </div>
              </button>
            ))}
          </ScrollArea>
        </Card>

        {/* Detalhe */}
        <Card className="flex-1 overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MailOpen className="h-12 w-12 mx-auto mb-2 opacity-30" />
                Selecione uma mensagem
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{selected.subject || "(sem assunto)"}</h2>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => toggleStar(selected)}>
                      <Star className={`h-4 w-4 ${selected.is_starred ? "fill-yellow-400 text-yellow-400" : ""}`} />
                    </Button>
                    {selected.folder !== "trash" && (
                      <Button variant="ghost" size="icon" onClick={() => moveToTrash(selected)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  <strong>{selected.from_name || selected.from_email}</strong>{" "}
                  &lt;{selected.from_email}&gt;
                </div>
                <div className="text-xs text-muted-foreground">
                  para: {selected.to_email} · {format(new Date(selected.received_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                {selected.body_html ? (
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selected.body_html }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm font-sans">{selected.body_text}</pre>
                )}
              </ScrollArea>

              <div className="p-4 border-t">
                {!replyOpen ? (
                  selected.folder !== "sent" && (
                    <Button onClick={openReply}>
                      <Reply className="h-4 w-4 mr-2" /> Responder
                    </Button>
                  )
                ) : (
                  <div className="space-y-2">
                    <Input
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                      placeholder="Assunto"
                    />
                    <Textarea
                      value={replyHtml}
                      onChange={(e) => setReplyHtml(e.target.value)}
                      placeholder="Sua resposta..."
                      rows={6}
                    />
                    <div className="flex gap-2">
                      <Button onClick={sendReply} disabled={sending || !replyHtml.trim()}>
                        {sending ? "Enviando..." : "Enviar resposta"}
                      </Button>
                      <Button variant="outline" onClick={() => setReplyOpen(false)}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}