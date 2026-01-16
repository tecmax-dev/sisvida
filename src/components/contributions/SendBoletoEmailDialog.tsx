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
import { Progress } from "@/components/ui/progress";
import { Loader2, Send, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";

const BOLETOS_PER_EMAIL = 15; // Maximum boletos per email to avoid timeout

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
  const [overrideEmail, setOverrideEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [clinicName, setClinicName] = useState("");
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, sent: 0, errors: 0 });

  // Filter contributions that have boleto generated (URL) OR public_access_token and are not paid/cancelled
  const eligibleContributions = contributions.filter(
    (c) => (c.lytex_invoice_url || c.public_access_token) && c.status !== "paid" && c.status !== "cancelled"
  );

  // Check if it's a single contribution (individual send mode)
  const isSingleMode = eligibleContributions.length === 1 || selectedIds.size === 1;

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
    } else if (eligibleContributions.length === 1) {
      setSelectedIds(new Set([eligibleContributions[0].id]));
    } else {
      setSelectedIds(new Set());
    }
    setOverrideEmail("");
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

  // Group contributions by employer email for batch sending
  const groupContributionsByEmail = () => {
    const selected = eligibleContributions.filter((c) => selectedIds.has(c.id));
    const groups = new Map<string, typeof selected>();

    // If override email is set and single mode, use it
    if (overrideEmail.trim() && isSingleMode) {
      groups.set(overrideEmail.trim(), selected);
      return groups;
    }

    // Group by employer email
    for (const contrib of selected) {
      const email = contrib.employers?.email?.trim();
      if (!email) continue;

      if (!groups.has(email)) {
        groups.set(email, []);
      }
      groups.get(email)!.push(contrib);
    }

    return groups;
  };

  // Count contributions without valid email
  const countWithoutEmail = () => {
    const selected = eligibleContributions.filter((c) => selectedIds.has(c.id));
    return selected.filter((c) => !c.employers?.email?.trim()).length;
  };

  const handleSend = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (overrideEmail.trim() && !emailRegex.test(overrideEmail.trim())) {
      toast.error("Email alternativo inválido");
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

    const emailGroups = groupContributionsByEmail();
    const withoutEmailCount = countWithoutEmail();

    if (emailGroups.size === 0) {
      toast.error("Nenhuma empresa selecionada possui email cadastrado");
      return;
    }

    setSending(true);

    try {
      let totalBatches = 0;
      // Calculate total batches across all email groups
      emailGroups.forEach((contribs) => {
        totalBatches += Math.ceil(contribs.length / BOLETOS_PER_EMAIL);
      });

      setSendProgress({ current: 0, total: totalBatches, sent: 0, errors: 0 });

      let successCount = 0;
      let errorCount = 0;
      let currentBatch = 0;

      for (const [email, contribs] of emailGroups) {
        const boletos = contribs.map((c) => {
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

        // Split boletos into batches to avoid timeout
        const batches: typeof boletos[] = [];
        for (let i = 0; i < boletos.length; i += BOLETOS_PER_EMAIL) {
          batches.push(boletos.slice(i, i + BOLETOS_PER_EMAIL));
        }

        const recipientName = contribs[0]?.employers?.name || email;

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          currentBatch++;
          setSendProgress({ current: currentBatch, total: totalBatches, sent: successCount, errors: errorCount });

          try {
            const { error } = await supabase.functions.invoke("send-boleto-email", {
              body: {
                recipientEmail: email,
                recipientName: recipientName,
                ccEmail: ccEmail.trim() || undefined,
                clinicName: clinicName || "Sindicato",
                boletos: batch,
              },
            });

            if (error) {
              console.error(`Erro ao enviar para ${email} (lote ${i + 1}):`, error);
              errorCount++;
            } else {
              successCount++;
            }
          } catch (batchError) {
            console.error(`Erro ao enviar para ${email} (lote ${i + 1}):`, batchError);
            errorCount++;
          }

          // Small delay between batches to avoid rate limiting
          if (currentBatch < totalBatches) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      setSendProgress({ current: totalBatches, total: totalBatches, sent: successCount, errors: errorCount });

      if (errorCount === 0 && withoutEmailCount === 0) {
        toast.success(
          successCount > 1
            ? `${successCount} email(s) enviado(s) com sucesso`
            : `Email enviado com sucesso`
        );
        onOpenChange(false);
      } else if (successCount > 0) {
        const messages = [];
        if (successCount > 0) messages.push(`${successCount} email(s) enviado(s)`);
        if (errorCount > 0) messages.push(`${errorCount} falha(s)`);
        if (withoutEmailCount > 0) messages.push(`${withoutEmailCount} sem email cadastrado`);
        toast.warning(messages.join(", "));
      } else {
        toast.error("Falha ao enviar todos os emails");
      }
    } catch (error: any) {
      console.error("Erro ao enviar email:", error);
      toast.error(error.message || "Erro ao enviar email");
    } finally {
      setSending(false);
      setSendProgress({ current: 0, total: 0, sent: 0, errors: 0 });
    }
  };

  const totalValue = eligibleContributions
    .filter((c) => selectedIds.has(c.id))
    .reduce((sum, c) => sum + c.value, 0);

  const withoutEmailCount = countWithoutEmail();
  const selectedWithEmail = selectedIds.size - withoutEmailCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            Enviar Boletos por Email
          </DialogTitle>
          <DialogDescription>
            {isSingleMode 
              ? "O email será enviado para o endereço cadastrado da empresa, ou você pode informar um email alternativo."
              : "Os emails serão enviados automaticamente para o endereço cadastrado de cada empresa."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Only show override email field for single contribution mode */}
          {isSingleMode && (
            <div className="space-y-2">
              <Label htmlFor="overrideEmail">Email alternativo (opcional)</Label>
              <Input
                id="overrideEmail"
                type="email"
                placeholder={eligibleContributions.find(c => selectedIds.has(c.id))?.employers?.email || "email@empresa.com"}
                value={overrideEmail}
                onChange={(e) => setOverrideEmail(e.target.value)}
                disabled={sending}
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para usar o email cadastrado da empresa
              </p>
            </div>
          )}

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

          {/* Selection summary and progress */}
          {selectedIds.size > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{selectedIds.size} boleto(s) selecionado(s)</span>
                <span className="font-medium text-foreground">
                  Total: {formatCurrency(totalValue)}
                </span>
              </div>
              
              {/* Warning for items without email */}
              {withoutEmailCount > 0 && (
                <p className="text-xs text-amber-600 text-center">
                  ⚠️ {withoutEmailCount} empresa(s) sem email cadastrado (não receberão)
                </p>
              )}
              
              {/* Info about how emails will be sent */}
              {!isSingleMode && selectedWithEmail > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {selectedWithEmail} email(s) serão enviados para os endereços cadastrados
                </p>
              )}
              
              {/* Progress bar during sending */}
              {sending && sendProgress.total > 0 && (
                <div className="space-y-1">
                  <Progress 
                    value={(sendProgress.current / sendProgress.total) * 100} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Enviando {sendProgress.current} de {sendProgress.total}... 
                    ({sendProgress.sent} sucesso, {sendProgress.errors} erro)
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || selectedIds.size === 0 || (selectedWithEmail === 0 && !overrideEmail.trim())}
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
