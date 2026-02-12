import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractFunctionsError } from "@/lib/functionsError";
import { useAuth } from "@/hooks/useAuth";
import {
  Mail,
  Loader2,
  Search,
  User,
  Building2,
  CheckCircle,
  AlertTriangle,
  Send,
  Pen,
  MessageCircle,
  Phone,
} from "lucide-react";

interface MemberWithoutSignature {
  id: string;
  nome: string;
  email: string | null;
  cpf: string;
  empresa_razao_social: string | null;
  telefone: string | null;
}

// Maps patients row to the member interface
function mapPatientToMember(p: any): MemberWithoutSignature {
  return {
    id: p.id,
    nome: p.name,
    email: p.email,
    cpf: p.cpf || "",
    empresa_razao_social: p.employer_name || null,
    telefone: p.phone || null,
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Channel = "email" | "whatsapp";

export function SendSignatureRequestDialog({ open, onOpenChange }: Props) {
  const { currentClinic } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberWithoutSignature[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0 });
  const [channel, setChannel] = useState<Channel>("whatsapp");

  useEffect(() => {
    if (!open || !currentClinic?.id) return;

    const fetchMembers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("patients")
          .select("id, name, email, cpf, phone, employer_name, signature_accepted")
          .eq("clinic_id", currentClinic.id)
          .eq("is_union_member", true)
          .eq("is_active", true)
          .or("signature_accepted.is.null,signature_accepted.eq.false")
          .order("name");

        if (error) throw error;
        setMembers((data || []).map(mapPatientToMember));
      } catch (err) {
        console.error("Error fetching members:", err);
        toast.error("Erro ao carregar sócios");
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [open, currentClinic?.id]);

  // Reset selection when channel changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [channel]);

  const filteredMembers = members.filter((m) => {
    const searchLower = search.toLowerCase();
    return (
      m.nome.toLowerCase().includes(searchLower) ||
      m.cpf.includes(search) ||
      m.email?.toLowerCase().includes(searchLower) ||
      m.empresa_razao_social?.toLowerCase().includes(searchLower) ||
      m.telefone?.includes(search)
    );
  });

  const hasContact = (m: MemberWithoutSignature) =>
    channel === "email" ? !!m.email : !!m.telefone;

  const membersWithContact = filteredMembers.filter(hasContact);
  const membersWithoutContact = filteredMembers.filter((m) => !hasContact(m));

  const handleSelectAll = () => {
    if (selectedIds.size === membersWithContact.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(membersWithContact.map((m) => m.id)));
    }
  };

  const handleToggle = (id: string) => {
    const member = members.find((m) => m.id === id);
    if (!member || !hasContact(member)) return;

    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSend = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos um sócio");
      return;
    }

    if (!currentClinic?.id) return;

    setSending(true);
    setSendProgress({ sent: 0, total: selectedIds.size });

    const selectedMembers = members.filter((m) => selectedIds.has(m.id));
    let successCount = 0;
    let errorCount = 0;
    let lastErrorMsg: string | null = null;

    const functionName =
      channel === "email" ? "send-signature-request" : "send-signature-whatsapp";

    for (const member of selectedMembers) {
      try {
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: {
            associadoId: member.id,
            clinicId: currentClinic.id,
          },
        });

        console.log(`[${functionName}] response`, {
          data,
          error,
          memberId: member.id,
        });

        if (error) {
          const extracted = extractFunctionsError(error);
          throw new Error(extracted.message);
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        successCount++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Erro desconhecido";
        lastErrorMsg = errMsg;
        console.error(`[${functionName}] error sending to ${member.nome}:`, errMsg);
        errorCount++;
      }

      setSendProgress((p) => ({ ...p, sent: p.sent + 1 }));
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setSending(false);

    const channelLabel = channel === "email" ? "email(s)" : "mensagem(ns)";

    if (successCount > 0) {
      toast.success(`${successCount} ${channelLabel} enviado(s) com sucesso!`);
    }
    if (errorCount > 0) {
      toast.error(
        `${errorCount} ${channelLabel} falharam${lastErrorMsg ? `: ${lastErrorMsg}` : ""}`
      );
    }

    if (successCount > 0) {
      setSelectedIds(new Set());
      onOpenChange(false);
    }
  };

  const formatCPF = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return cpf;
    return `***.***.${cleaned.slice(6, 9)}-**`;
  };

  const contactLabel = channel === "email" ? "email" : "telefone";
  const ContactIcon = channel === "email" ? Mail : Phone;
  const noContactLabel = channel === "email" ? "Sem email" : "Sem telefone";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pen className="h-5 w-5 text-violet-600" />
            Solicitar Assinatura Digital
          </DialogTitle>
          <DialogDescription>
            Envie um link para sócios autorizarem o desconto em folha
          </DialogDescription>
        </DialogHeader>

        {/* Channel selector */}
        <Tabs
          value={channel}
          onValueChange={(v) => setChannel(v as Channel)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="whatsapp" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
            <h3 className="font-medium text-lg">Todos os sócios já assinaram!</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Não há sócios pendentes de assinatura
            </p>
          </div>
        ) : (
          <>
            {/* Search and actions */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF, email, telefone ou empresa..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={membersWithContact.length === 0}
              >
                {selectedIds.size === membersWithContact.length
                  ? "Desmarcar"
                  : "Selecionar"}{" "}
                Todos
              </Button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <Badge variant="outline" className="gap-1">
                <User className="h-3 w-3" />
                {filteredMembers.length} sócio(s)
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <ContactIcon className="h-3 w-3" />
                {membersWithContact.length} com {contactLabel}
              </Badge>
              {membersWithoutContact.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {membersWithoutContact.length} sem {contactLabel}
                </Badge>
              )}
              {selectedIds.size > 0 && (
                <Badge className="bg-violet-600 gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {selectedIds.size} selecionado(s)
                </Badge>
              )}
            </div>

            {/* Members list */}
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredMembers.map((member) => {
                  const memberHasContact = hasContact(member);
                  return (
                    <div
                      key={member.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        memberHasContact
                          ? selectedIds.has(member.id)
                            ? "bg-violet-50 border-violet-200"
                            : "hover:bg-muted/50 cursor-pointer"
                          : "bg-muted/30 opacity-60"
                      }`}
                      onClick={() => handleToggle(member.id)}
                    >
                      <Checkbox
                        checked={selectedIds.has(member.id)}
                        disabled={!memberHasContact}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => handleToggle(member.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{member.nome}</p>
                          {!memberHasContact && (
                            <Badge variant="destructive" className="text-xs">
                              {noContactLabel}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="font-mono">{formatCPF(member.cpf)}</span>
                          {channel === "email" && member.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {member.email}
                            </span>
                          )}
                          {channel === "whatsapp" && member.telefone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {member.telefone}
                            </span>
                          )}
                        </div>
                        {member.empresa_razao_social && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building2 className="h-3 w-3" />
                            {member.empresa_razao_social}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || selectedIds.size === 0}
            className={
              channel === "whatsapp"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : ""
            }
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando {sendProgress.sent}/{sendProgress.total}...
              </>
            ) : (
              <>
                {channel === "whatsapp" ? (
                  <MessageCircle className="h-4 w-4 mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Enviar para {selectedIds.size} sócio(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
