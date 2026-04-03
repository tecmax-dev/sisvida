import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Phone,
  User,
  MessageSquarePlus,
  Loader2,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import type { WhazingTicket } from "@/hooks/useWhazingTickets";

interface EvolutionContact {
  remoteJid?: string;
  pushName?: string;
  profilePicUrl?: string;
}

function extractPhone(jid: string | undefined): string {
  if (!jid) return "";
  return jid.replace(/@.*$/, "");
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

async function fetchEvolutionContacts(): Promise<EvolutionContact[]> {
  const { data, error } = await supabase.functions.invoke("evolution-contacts");
  if (error) throw new Error(error.message || "Erro ao buscar contatos");
  return Array.isArray(data) ? data : [];
}

interface NewChatContactListProps {
  onStartChat: (ticket: WhazingTicket) => void;
}

export default function NewChatContactList({ onStartChat }: NewChatContactListProps) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState<string | null>(null);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["evolution-contacts"],
    queryFn: fetchEvolutionContacts,
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    return (contacts || [])
      .filter((c) => {
        const jid = c.remoteJid || "";
        if (!jid.endsWith("@s.whatsapp.net")) return false;
        if (!search) return true;
        const s = search.toLowerCase();
        const phone = extractPhone(jid);
        const name = (c.pushName || "").toLowerCase();
        return name.includes(s) || phone.includes(s) || formatPhone(phone).includes(s);
      })
      .sort((a, b) => (a.pushName || "").localeCompare(b.pushName || ""));
  }, [contacts, search]);

  // Allow manual phone entry
  const manualPhone = search.replace(/\D/g, "");
  const showManualEntry = manualPhone.length >= 10 && !filtered.some(c => extractPhone(c.remoteJid) === manualPhone || extractPhone(c.remoteJid) === `55${manualPhone}`);

  const handleStartChat = async (phone: string, name?: string) => {
    setCreating(phone);
    try {
      let cleanPhone = phone.replace(/\D/g, "");
      if (!cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;

      // Upsert ticket
      const { data, error } = await (supabase as any)
        .from("whazing_tickets")
        .upsert(
          {
            ticket_id: cleanPhone,
            contact_number: cleanPhone,
            contact_name: name || null,
            status: "open",
            opened_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "ticket_id" }
        )
        .select()
        .single();

      if (error) throw error;

      toast.success("Chat aberto com " + (name || formatPhone(cleanPhone)));
      onStartChat(data as WhazingTicket);
    } catch (err: any) {
      toast.error("Erro ao abrir chat: " + (err.message || "erro desconhecido"));
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou digitar telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Manual phone entry */}
      {showManualEntry && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-primary/40 bg-primary/5">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Phone className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Novo número</p>
            <p className="text-xs text-muted-foreground">{formatPhone(manualPhone)}</p>
          </div>
          <Button
            size="sm"
            onClick={() => handleStartChat(manualPhone)}
            disabled={creating === manualPhone}
          >
            {creating === manualPhone ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <MessageSquarePlus className="h-4 w-4 mr-1" />
                Iniciar
              </>
            )}
          </Button>
        </div>
      )}

      {/* Contact list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Carregando contatos...
        </div>
      ) : filtered.length === 0 && !showManualEntry ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Inbox className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">
            {search ? "Nenhum contato encontrado" : "Digite para buscar ou inserir um número"}
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[55vh]">
          <div className="space-y-1">
            {filtered.map((contact) => {
              const phone = extractPhone(contact.remoteJid);
              return (
                <div
                  key={contact.remoteJid}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer group"
                  onClick={() => handleStartChat(phone, contact.pushName)}
                >
                  {contact.profilePicUrl ? (
                    <img
                      src={contact.profilePicUrl}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {contact.pushName || "Sem nome"}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {formatPhone(phone)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-7"
                    disabled={creating === phone}
                  >
                    {creating === phone ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
