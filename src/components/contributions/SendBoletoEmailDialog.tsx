import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Mail } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";

interface Contribution {
  id: string;
  value: number;
  due_date: string;
  status: string;
  competence_month: number;
  competence_year: number;
  lytex_invoice_id: string | null;
  lytex_invoice_url: string | null;
  lytex_boleto_digitable_line?: string | null;
  lytex_pix_code?: string | null;
  public_access_token?: string | null;
  employers?: {
    name: string;
    cnpj: string;
    email?: string | null;
  };
  contribution_types?: {
    name: string;
  };
}

interface SendBoletoEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contributions: Contribution[];
  clinicId: string;
  preSelectedIds?: Set<string>;
  defaultEmail?: string;
  defaultName?: string;
}

export function SendBoletoEmailDialog({
  open,
  onOpenChange,
  contributions,
  clinicId,
  preSelectedIds,
  defaultEmail = "",
  defaultName = "",
}: SendBoletoEmailDialogProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [clinicName, setClinicName] = useState("");

  // Filter contributions that have boleto generated (URL) OR public_access_token and are not paid/cancelled
  const eligibleContributions = contributions.filter(
    (c) => (c.lytex_invoice_url || c.public_access_token) && c.status !== "paid" && c.status !== "cancelled"
  );

  useEffect(() => {
    if (open) {
      initializeState();
      fetchClinicName();
    }
  }, [open]);

  const initializeState = () => {
    // Initialize with preSelectedIds if available
    if (preSelectedIds && preSelectedIds.size > 0) {
      const validIds = new Set<string>();
      preSelectedIds.forEach((id) => {
        if (eligibleContributions.some((c) => c.id === id)) {
          validIds.add(id);
        }
      });
      setSelectedIds(validIds);

      // Pre-fill email/name if single employer
      const selectedContribs = eligibleContributions.filter((c) => validIds.has(c.id));
      const uniqueEmployers = new Set(selectedContribs.map((c) => c.employers?.cnpj));
      
      if (uniqueEmployers.size === 1 && selectedContribs[0]?.employers) {
        setRecipientEmail(selectedContribs[0].employers.email || defaultEmail);
        setRecipientName(selectedContribs[0].employers.name || defaultName);
      } else {
        setRecipientEmail(defaultEmail);
        setRecipientName(defaultName);
      }
    } else if (eligibleContributions.length === 1 && eligibleContributions[0].employers) {
      setSelectedIds(new Set([eligibleContributions[0].id]));
      setRecipientEmail(eligibleContributions[0].employers.email || defaultEmail);
      setRecipientName(eligibleContributions[0].employers.name || defaultName);
    } else {
      setSelectedIds(new Set());
      setRecipientEmail(defaultEmail);
      setRecipientName(defaultName);
    }
    setCcEmail("");
  };

  const fetchClinicName = async () => {
    try {
      const { data } = await supabase
        .from("clinics")
        .select("name")
        .eq("id", clinicId)
        .single();
      if (data) setClinicName(data.name);
    } catch (error) {
      console.error("Error fetching clinic name:", error);
    }
  };

  const handleToggle = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === eligibleContributions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleContributions.map((c) => c.id)));
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100);
  };

  const handleSend = async () => {
    if (!recipientEmail.trim()) {
      toast.error("Digite o email do destinatário");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      toast.error("Email do destinatário inválido");
      return;
    }

    if (ccEmail && !emailRegex.test(ccEmail)) {
      toast.error("Email de cópia inválido");
      return;
    }

    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos um boleto para enviar");
      return;
    }

    setSending(true);

    try {
      const selected = eligibleContributions.filter((c) => selectedIds.has(c.id));

      const boletos = selected.map((c) => {
        const isAwaitingValue = c.status === "awaiting_value" || (!c.lytex_invoice_url && c.public_access_token);
        const invoiceUrl = isAwaitingValue && c.public_access_token
          ? `${window.location.origin}/contribuicao/${c.public_access_token}`
          : c.lytex_invoice_url || "";
        
        return {
          employerName: c.employers?.name || "Empresa",
          employerCnpj: c.employers?.cnpj || "",
          contributionType: c.contribution_types?.name || "Contribuição",
          competenceMonth: c.competence_month,
          competenceYear: c.competence_year,
          dueDate: c.due_date,
          value: c.value,
          status: c.status,
          invoiceUrl,
          digitableLine: c.lytex_boleto_digitable_line || undefined,
          pixCode: c.lytex_pix_code || undefined,
          isAwaitingValue,
        };
      });

      const { data, error } = await supabase.functions.invoke("send-boleto-email", {
        body: {
          recipientEmail: recipientEmail.trim(),
          recipientName: recipientName.trim() || recipientEmail,
          ccEmail: ccEmail.trim() || undefined,
          clinicName: clinicName || "Sindicato",
          boletos,
        },
      });

      if (error) throw error;

      toast.success(`Email enviado com sucesso para ${recipientEmail}`);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao enviar email:", error);
      toast.error(error.message || "Erro ao enviar email");
    } finally {
      setSending(false);
    }
  };

  const totalValue = eligibleContributions
    .filter((c) => selectedIds.has(c.id))
    .reduce((sum, c) => sum + c.value, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            Enviar Boletos por Email
          </DialogTitle>
          <DialogDescription>
            Selecione os boletos e informe o email para envio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recipientEmail">Email do destinatário *</Label>
              <Input
                id="recipientEmail"
                type="email"
                placeholder="email@empresa.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                disabled={sending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipientName">Nome do destinatário</Label>
              <Input
                id="recipientName"
                placeholder="Nome da empresa"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                disabled={sending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ccEmail">Email em cópia (CC)</Label>
            <Input
              id="ccEmail"
              type="email"
              placeholder="copia@outro.com (opcional)"
              value={ccEmail}
              onChange={(e) => setCcEmail(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Boletos Disponíveis</Label>
              {eligibleContributions.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs h-7"
                  disabled={sending}
                >
                  {selectedIds.size === eligibleContributions.length
                    ? "Desmarcar todos"
                    : "Selecionar todos"}
                </Button>
              )}
            </div>

            {eligibleContributions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum boleto disponível para envio.
                <br />
                <span className="text-xs">
                  (Boletos ou links de valor não encontrados)
                </span>
              </p>
            ) : (
              <ScrollArea className="h-[180px] border rounded-md">
                <div className="p-2 space-y-2">
                  {eligibleContributions.map((contrib) => {
                    const monthName = format(
                      new Date(contrib.competence_year, contrib.competence_month - 1),
                      "MMM/yy",
                      { locale: ptBR }
                    );
                    return (
                      <div
                        key={contrib.id}
                        className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                          selectedIds.has(contrib.id)
                            ? "bg-primary/5 border-primary"
                            : "hover:bg-muted/50"
                        } ${sending ? "pointer-events-none opacity-60" : ""}`}
                        onClick={() => !sending && handleToggle(contrib.id)}
                      >
                        <Checkbox
                          checked={selectedIds.has(contrib.id)}
                          onCheckedChange={() => handleToggle(contrib.id)}
                          className="mt-0.5"
                          disabled={sending}
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm font-medium leading-tight">
                            {contrib.employers?.name || "Empresa"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {monthName} • Venc: {format(parseDateOnlyToLocalNoon(contrib.due_date), "dd/MM/yy")}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-sm font-semibold whitespace-nowrap">
                            {contrib.status === "awaiting_value" || (!contrib.lytex_invoice_url && contrib.public_access_token)
                              ? "Sem valor"
                              : formatCurrency(contrib.value)}
                          </span>
                          <Badge
                            variant={
                              contrib.status === "awaiting_value" || (!contrib.lytex_invoice_url && contrib.public_access_token)
                                ? "secondary"
                                : contrib.status === "overdue" 
                                  ? "destructive" 
                                  : "outline"
                            }
                            className="text-[10px] px-1.5"
                          >
                            {contrib.status === "awaiting_value" || (!contrib.lytex_invoice_url && contrib.public_access_token)
                              ? "Aguardando"
                              : contrib.status === "overdue" 
                                ? "Vencido" 
                                : "Pendente"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{selectedIds.size} boleto(s) selecionado(s)</span>
              <span className="font-medium text-foreground">
                Total: {formatCurrency(totalValue)}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || selectedIds.size === 0 || !recipientEmail.trim()}
            className="gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
