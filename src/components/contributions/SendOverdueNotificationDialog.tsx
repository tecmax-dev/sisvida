import { useState, useEffect, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Send,
  MessageCircle,
  Mail,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { supabase } from "@/integrations/supabase/client";
import { formatCompetence } from "@/lib/competence-format";

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
    phone?: string | null;
    email?: string | null;
  };
  contribution_types?: {
    name: string;
  };
}

interface SendOverdueNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contributions: Contribution[];
  clinicId: string;
  preSelectedIds?: Set<string>;
}

const DELAY_OPTIONS = [
  { value: 5, label: "5 segundos (risco)" },
  { value: 10, label: "10 segundos" },
  { value: 15, label: "15 segundos" },
  { value: 20, label: "20 segundos (recomendado)" },
  { value: 30, label: "30 segundos" },
  { value: 60, label: "60 segundos (conservador)" },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function SendOverdueNotificationDialog({
  open,
  onOpenChange,
  contributions,
  clinicId,
  preSelectedIds,
}: SendOverdueNotificationDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, sent: 0, errors: 0 });
  const [channelTab, setChannelTab] = useState<"whatsapp" | "email">("whatsapp");
  const [delaySeconds, setDelaySeconds] = useState(20);
  const [ccEmail, setCcEmail] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [customMessage, setCustomMessage] = useState("");

  // Filter only overdue contributions
  const overdueContributions = useMemo(() => {
    return contributions.filter((c) => c.status === "overdue");
  }, [contributions]);

  useEffect(() => {
    if (open) {
      initializeState();
      fetchClinicName();
    }
  }, [open]);

  const initializeState = () => {
    if (preSelectedIds && preSelectedIds.size > 0) {
      const validIds = new Set<string>();
      preSelectedIds.forEach((id) => {
        if (overdueContributions.some((c) => c.id === id)) {
          validIds.add(id);
        }
      });
      setSelectedIds(validIds.size > 0 ? validIds : new Set(overdueContributions.map((c) => c.id)));
    } else {
      setSelectedIds(new Set(overdueContributions.map((c) => c.id)));
    }
    setCcEmail("");
    setCustomMessage("");
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
    if (selectedIds.size === overdueContributions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(overdueContributions.map((c) => c.id)));
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100);
  };

  const getDaysOverdue = (dueDate: string) => {
    return differenceInDays(new Date(), parseDateOnlyToLocalNoon(dueDate));
  };

  const buildWhatsAppMessage = (contrib: Contribution) => {
    const dueDate = format(parseDateOnlyToLocalNoon(contrib.due_date), "dd/MM/yyyy");
    const daysOverdue = getDaysOverdue(contrib.due_date);
    const entityName = clinicName || "Sindicato";
    
    const linkUrl = contrib.lytex_invoice_url 
      || (contrib.public_access_token ? `${window.location.origin}/contribuicao/${contrib.public_access_token}` : null);

    if (customMessage.trim()) {
      return customMessage
        .replace(/\{empresa\}/gi, contrib.employers?.name || "Empresa")
        .replace(/\{valor\}/gi, formatCurrency(contrib.value))
        .replace(/\{vencimento\}/gi, dueDate)
        .replace(/\{dias_atraso\}/gi, String(daysOverdue))
        .replace(/\{competencia\}/gi, formatCompetence(contrib.competence_month, contrib.competence_year))
        .replace(/\{tipo\}/gi, contrib.contribution_types?.name || "Contribuição")
        .replace(/\{link\}/gi, linkUrl || "")
        .replace(/\{entidade\}/gi, entityName);
    }

    return `⚠️ *NOTIFICAÇÃO DE COBRANÇA VENCIDA*

━━━━━━━━━━━━━━━━
*${entityName}*
━━━━━━━━━━━━━━━━

Prezado(a) responsável pela empresa *${contrib.employers?.name || "N/A"}*,

Informamos que a contribuição abaixo encontra-se *VENCIDA há ${daysOverdue} dia(s)*:

📋 *Tipo:* ${contrib.contribution_types?.name || "Contribuição"}
📅 *Competência:* ${formatCompetence(contrib.competence_month, contrib.competence_year)}
💰 *Valor:* ${formatCurrency(contrib.value)}
📆 *Vencimento:* ${dueDate}
⏰ *Dias em atraso:* ${daysOverdue}

${linkUrl ? `🔗 *Acesse o boleto:*\n${linkUrl}\n` : ""}
Solicitamos a regularização o mais breve possível para evitar eventuais penalidades.

Em caso de dúvidas ou para negociação, entre em contato conosco.

_${entityName}_`;
  };

  const buildEmailMessage = (contribs: Contribution[]) => {
    const entityName = clinicName || "Sindicato";
    
    const boletosList = contribs.map((c) => {
      const dueDate = format(parseDateOnlyToLocalNoon(c.due_date), "dd/MM/yyyy");
      const daysOverdue = getDaysOverdue(c.due_date);
      const linkUrl = c.lytex_invoice_url 
        || (c.public_access_token ? `${window.location.origin}/contribuicao/${c.public_access_token}` : null);
      
      return `**${c.contribution_types?.name || "Contribuição"}** - ${formatCompetence(c.competence_month, c.competence_year)}
Valor: ${formatCurrency(c.value)} | Vencimento: ${dueDate} | Atraso: ${daysOverdue} dia(s)${linkUrl ? `\nLink: ${linkUrl}` : ""}`;
    }).join("\n\n");

    const totalValue = contribs.reduce((sum, c) => sum + c.value, 0);

    return `⚠️ **NOTIFICAÇÃO DE COBRANÇA VENCIDA**

━━━━━━━━━━━━━━━━

Prezado(a) responsável pela empresa **${contribs[0]?.employers?.name || "N/A"}**,

Informamos que as seguintes contribuições encontram-se **VENCIDAS**:

━━━━━━━━━━━━━━━━

${boletosList}

━━━━━━━━━━━━━━━━
**Total em aberto: ${formatCurrency(totalValue)}**

Solicitamos a regularização o mais breve possível para evitar eventuais penalidades.

Em caso de dúvidas ou para negociação, entre em contato conosco.

_${entityName}_`;
  };

  const handleSendWhatsApp = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos uma contribuição");
      return;
    }

    const selected = overdueContributions.filter((c) => selectedIds.has(c.id));
    const withoutPhone = selected.filter((c) => !c.employers?.phone);
    
    if (withoutPhone.length === selected.length) {
      toast.error("Nenhuma empresa selecionada possui telefone cadastrado");
      return;
    }

    setSending(true);
    const toSend = selected.filter((c) => c.employers?.phone);
    setSendProgress({ current: 0, total: toSend.length, sent: 0, errors: 0 });

    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < toSend.length; i++) {
        const contrib = toSend[i];
        setSendProgress({ current: i + 1, total: toSend.length, sent: successCount, errors: errorCount });

        const message = buildWhatsAppMessage(contrib);
        const result = await sendWhatsAppMessage({
          phone: contrib.employers!.phone!,
          message,
          clinicId,
          type: "custom",
        });

        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          console.error(`Erro no envio para ${contrib.employers?.name}:`, result.error);
          if (result.error?.includes("Limite") || result.error?.includes("limite")) {
            toast.error("📊 Limite de mensagens atingido!");
            break;
          }
        }

        if (i < toSend.length - 1) {
          await delay(delaySeconds * 1000);
        }
      }

      if (errorCount === 0) {
        toast.success(`${successCount} notificação(ões) enviada(s) com sucesso!`);
      } else {
        toast.warning(`${successCount} enviada(s), ${errorCount} falha(s)${withoutPhone.length > 0 ? `, ${withoutPhone.length} sem telefone` : ""}`);
      }

      if (successCount > 0) {
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Erro ao enviar notificações:", error);
      toast.error(error.message || "Erro ao enviar notificações");
    } finally {
      setSending(false);
      setSendProgress({ current: 0, total: 0, sent: 0, errors: 0 });
    }
  };

  const handleSendEmail = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos uma contribuição");
      return;
    }

    const selected = overdueContributions.filter((c) => selectedIds.has(c.id));

    // Group by employer email
    const groups = new Map<string, Contribution[]>();
    for (const contrib of selected) {
      const email = contrib.employers?.email?.trim();
      if (!email) continue;
      if (!groups.has(email)) groups.set(email, []);
      groups.get(email)!.push(contrib);
    }

    if (groups.size === 0) {
      toast.error("Nenhuma empresa selecionada possui email cadastrado");
      return;
    }

    setSending(true);
    const totalEmails = groups.size;
    setSendProgress({ current: 0, total: totalEmails, sent: 0, errors: 0 });

    let successCount = 0;
    let errorCount = 0;
    let current = 0;

    try {
      for (const [email, contribs] of groups) {
        current++;
        setSendProgress({ current, total: totalEmails, sent: successCount, errors: errorCount });

        const message = buildEmailMessage(contribs);
        const totalValue = contribs.reduce((sum, c) => sum + c.value, 0);
        const subject = `⚠️ Notificação de Cobrança Vencida - ${contribs[0]?.employers?.name || "Empresa"} - ${formatCurrency(totalValue)}`;

        try {
          const { error } = await supabase.functions.invoke("send-contribution-email", {
            body: {
              to: email,
              subject,
              message,
              clinicId,
              memberName: contribs[0]?.employers?.name,
            },
          });

          if (error) {
            console.error(`Erro ao enviar para ${email}:`, error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (e) {
          console.error(`Erro ao enviar para ${email}:`, e);
          errorCount++;
        }

        if (current < totalEmails) {
          await delay(500);
        }
      }

      const withoutEmail = selected.filter((c) => !c.employers?.email?.trim()).length;

      if (errorCount === 0 && withoutEmail === 0) {
        toast.success(`${successCount} email(s) de cobrança enviado(s) com sucesso!`);
        onOpenChange(false);
      } else if (successCount > 0) {
        const msgs = [];
        if (successCount > 0) msgs.push(`${successCount} enviado(s)`);
        if (errorCount > 0) msgs.push(`${errorCount} falha(s)`);
        if (withoutEmail > 0) msgs.push(`${withoutEmail} sem email`);
        toast.warning(msgs.join(", "));
      } else {
        toast.error("Falha ao enviar todos os emails");
      }
    } catch (error: any) {
      console.error("Erro ao enviar emails:", error);
      toast.error(error.message || "Erro ao enviar emails de cobrança");
    } finally {
      setSending(false);
      setSendProgress({ current: 0, total: 0, sent: 0, errors: 0 });
    }
  };

  const totalValue = overdueContributions
    .filter((c) => selectedIds.has(c.id))
    .reduce((sum, c) => sum + c.value, 0);

  const estimatedMinutes = Math.ceil((selectedIds.size * delaySeconds) / 60);

  const withoutPhoneCount = overdueContributions
    .filter((c) => selectedIds.has(c.id) && !c.employers?.phone)
    .length;

  const withoutEmailCount = overdueContributions
    .filter((c) => selectedIds.has(c.id) && !c.employers?.email?.trim())
    .length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            Notificação de Cobrança Vencida
          </DialogTitle>
          <DialogDescription>
            Envie notificações para empresas com contribuições vencidas via WhatsApp ou Email.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={channelTab} onValueChange={(v) => setChannelTab(v as "whatsapp" | "email")}>
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

          <TabsContent value="whatsapp" className="space-y-3 mt-3">
            <div className="space-y-2">
              <Label>Intervalo entre envios</Label>
              <Select
                value={delaySeconds.toString()}
                onValueChange={(val) => setDelaySeconds(Number(val))}
                disabled={sending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELAY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedIds.size > 1 && (
                <p className="text-xs text-amber-600">
                  ⏱️ Tempo estimado: ~{estimatedMinutes} min ({selectedIds.size} notificações)
                </p>
              )}
            </div>
            {withoutPhoneCount > 0 && (
              <p className="text-xs text-amber-600">
                ⚠️ {withoutPhoneCount} empresa(s) sem telefone cadastrado (não receberão)
              </p>
            )}
          </TabsContent>

          <TabsContent value="email" className="space-y-3 mt-3">
            <div className="space-y-2">
              <Label htmlFor="ccEmail">Email em cópia (CC)</Label>
              <Input
                id="ccEmail"
                type="email"
                placeholder="copia@exemplo.com (opcional)"
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                disabled={sending}
              />
            </div>
            {withoutEmailCount > 0 && (
              <p className="text-xs text-amber-600">
                ⚠️ {withoutEmailCount} empresa(s) sem email cadastrado (não receberão)
              </p>
            )}
          </TabsContent>
        </Tabs>

        {/* Custom message (optional) - WhatsApp only */}
        {channelTab === "whatsapp" && (
          <div className="space-y-2">
            <Label>Mensagem personalizada (opcional)</Label>
            <Textarea
              placeholder="Deixe vazio para usar o modelo padrão. Use: {empresa}, {valor}, {vencimento}, {dias_atraso}, {competencia}, {tipo}, {link}, {entidade}"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={3}
              disabled={sending}
              className="text-sm"
            />
          </div>
        )}

        {/* Contributions list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Contribuições Vencidas</Label>
            {overdueContributions.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="text-xs h-7"
                disabled={sending}
              >
                {selectedIds.size === overdueContributions.length ? "Desmarcar" : "Selecionar"} todos
              </Button>
            )}
          </div>

          {overdueContributions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-sm text-muted-foreground">
                Nenhuma contribuição vencida encontrada! 🎉
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[200px] border rounded-md">
              <div className="p-2 space-y-2">
                {overdueContributions.map((contrib) => {
                  const daysOverdue = getDaysOverdue(contrib.due_date);
                  return (
                    <div
                      key={contrib.id}
                      className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                        selectedIds.has(contrib.id)
                          ? "bg-rose-50 border-rose-300 dark:bg-rose-950/30 dark:border-rose-700"
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
                          {contrib.contribution_types?.name} • {formatCompetence(contrib.competence_month, contrib.competence_year)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-sm font-semibold whitespace-nowrap">
                          {formatCurrency(contrib.value)}
                        </span>
                        <Badge variant="destructive" className="text-[10px] px-1.5">
                          {daysOverdue}d atraso
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Summary */}
        {selectedIds.size > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{selectedIds.size} contribuição(ões) selecionada(s)</span>
              <span className="font-medium text-foreground">
                Total: {formatCurrency(totalValue)}
              </span>
            </div>

            {sending && sendProgress.total > 0 && (
              <div className="space-y-1">
                <Progress value={(sendProgress.current / sendProgress.total) * 100} />
                <p className="text-xs text-muted-foreground text-center">
                  Enviando {sendProgress.current}/{sendProgress.total}
                  {sendProgress.sent > 0 && ` • ${sendProgress.sent} sucesso`}
                  {sendProgress.errors > 0 && ` • ${sendProgress.errors} erro(s)`}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={channelTab === "whatsapp" ? handleSendWhatsApp : handleSendEmail}
            disabled={sending || selectedIds.size === 0 || overdueContributions.length === 0}
            className="gap-2"
            variant="destructive"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar {channelTab === "whatsapp" ? "WhatsApp" : "Email"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
