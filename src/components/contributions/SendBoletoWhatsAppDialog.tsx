import { useState, useEffect } from "react";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
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
  public_access_token?: string | null;
  employers?: {
    name: string;
    cnpj: string;
    phone?: string | null;
  };
  contribution_types?: {
    name: string;
  };
}

interface SendBoletoWhatsAppDialogProps {
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
  { value: 45, label: "45 segundos" },
  { value: 60, label: "60 segundos (conservador)" },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function SendBoletoWhatsAppDialog({
  open,
  onOpenChange,
  contributions,
  clinicId,
  preSelectedIds,
}: SendBoletoWhatsAppDialogProps) {
  const [phone, setPhone] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  const [delaySeconds, setDelaySeconds] = useState(10);
  const [loadingConfig, setLoadingConfig] = useState(false);

  useEffect(() => {
    if (open && clinicId) {
      loadClinicConfig();
    }
  }, [open, clinicId]);

  const loadClinicConfig = async () => {
    try {
      setLoadingConfig(true);
      const { data, error } = await supabase
        .from("clinics")
        .select("whatsapp_message_delay_seconds")
        .eq("id", clinicId)
        .single();

      if (!error && data?.whatsapp_message_delay_seconds) {
        setDelaySeconds(data.whatsapp_message_delay_seconds);
      }
    } catch (error) {
      console.error("Error loading clinic config:", error);
    } finally {
      setLoadingConfig(false);
    }
  };

  const eligibleContributions = contributions.filter(
    (c) => (c.lytex_invoice_id || c.public_access_token) && c.status !== "paid" && c.status !== "cancelled"
  );

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

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSend = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Digite um número de telefone válido");
      return;
    }

    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos um boleto para enviar");
      return;
    }

    setSending(true);
    const selected = eligibleContributions.filter((c) => selectedIds.has(c.id));
    setSendProgress({ current: 0, total: selected.length });

    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < selected.length; i++) {
        const contrib = selected[i];
        setSendProgress({ current: i + 1, total: selected.length });

        const monthName = format(
          new Date(contrib.competence_year, contrib.competence_month - 1),
          "MMMM/yyyy",
          { locale: ptBR }
        );
        const dueDate = format(parseDateOnlyToLocalNoon(contrib.due_date), "dd/MM/yyyy");
        
        const isAwaitingValue = contrib.status === "awaiting_value" || (!contrib.lytex_invoice_url && contrib.public_access_token);
        const statusLabel = isAwaitingValue 
          ? "📝 Aguardando valor" 
          : contrib.status === "overdue" 
            ? "⚠️ VENCIDO" 
            : "🟢 A vencer";
        
        const linkUrl = isAwaitingValue && contrib.public_access_token
          ? `${window.location.origin}/contribuicao/${contrib.public_access_token}`
          : contrib.lytex_invoice_url;

        const message = isAwaitingValue
          ? `📋 *Contribuição - Informe o Valor*

━━━━━━━━━━━━━━━━
*Empresa:* ${contrib.employers?.name || "N/A"}
*Competência:* ${monthName}
*Vencimento:* ${dueDate}
*Status:* ${statusLabel}

🔗 *Clique para informar o valor:*
${linkUrl}
━━━━━━━━━━━━━━━━`
          : `📋 *Boleto de Contribuição*

━━━━━━━━━━━━━━━━
*Empresa:* ${contrib.employers?.name || "N/A"}
*Competência:* ${monthName}
*Vencimento:* ${dueDate}
*Valor:* ${formatCurrency(contrib.value)}
*Status:* ${statusLabel}

🔗 *Link do Boleto:*
${linkUrl}
━━━━━━━━━━━━━━━━`;

        const result = await sendWhatsAppMessage({
          phone: cleanPhone,
          message,
          clinicId,
          type: "custom",
        });

        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          console.error(`Erro no boleto ${i + 1}:`, result.error);
          
          if (result.error?.includes('Limite') || result.error?.includes('limite')) {
            toast.error("📊 Limite de mensagens atingido!\n\nFaça upgrade do plano para continuar enviando.");
            break;
          }
        }

        if (i < selected.length - 1) {
          await delay(delaySeconds * 1000);
        }
      }

      if (errorCount === 0) {
        toast.success(`${successCount} boleto(s) enviado(s) com sucesso!`);
      } else {
        toast.warning(`${successCount} enviado(s), ${errorCount} falha(s)`);
      }

      onOpenChange(false);
      setPhone("");
      setSelectedIds(new Set());
    } catch (error: any) {
      console.error("Erro ao enviar boletos:", error);
      toast.error(error.message || "Erro ao enviar boletos via WhatsApp");
    } finally {
      setSending(false);
      setSendProgress({ current: 0, total: 0 });
    }
  };

  const handleOpen = () => {
    setPhone("");
    
    if (preSelectedIds && preSelectedIds.size > 0) {
      const validIds = new Set<string>();
      preSelectedIds.forEach((id) => {
        if (eligibleContributions.some((c) => c.id === id)) {
          validIds.add(id);
        }
      });
      setSelectedIds(validIds);
      
      if (validIds.size === 1) {
        const selected = eligibleContributions.find((c) => validIds.has(c.id));
        if (selected?.employers?.phone) {
          setPhone(formatPhone(selected.employers.phone));
        }
      }
    } else if (eligibleContributions.length === 1 && eligibleContributions[0].employers?.phone) {
      setPhone(formatPhone(eligibleContributions[0].employers.phone));
      setSelectedIds(new Set([eligibleContributions[0].id]));
    }
  };

  useEffect(() => {
    if (open) {
      handleOpen();
    }
  }, [open]);

  const estimatedMinutes = Math.ceil((selectedIds.size * delaySeconds) / 60);

  return (
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="lg">
      <PopupHeader>
        <PopupTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-emerald-600" />
          Enviar Boletos via WhatsApp
        </PopupTitle>
        <PopupDescription>
          Selecione os boletos e informe o número para envio.
        </PopupDescription>
      </PopupHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Número do WhatsApp</Label>
          <Input
            id="phone"
            placeholder="(00) 00000-0000"
            value={phone}
            onChange={handlePhoneChange}
            maxLength={16}
            disabled={sending}
          />
        </div>

        {selectedIds.size > 1 && (
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
            <p className="text-xs text-amber-600">
              ⏱️ Tempo estimado: ~{estimatedMinutes} min ({selectedIds.size} boletos)
            </p>
          </div>
        )}

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
            <ScrollArea className="h-[200px] border rounded-md">
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
          <p className="text-sm text-muted-foreground">
            {selectedIds.size} boleto(s) selecionado(s)
          </p>
        )}
      </div>

      <PopupFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
          Cancelar
        </Button>
        <Button
          onClick={handleSend}
          disabled={sending || selectedIds.size === 0 || phone.replace(/\D/g, "").length < 10}
          className="gap-2"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {sendProgress.current}/{sendProgress.total}
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Enviar
            </>
          )}
        </Button>
      </PopupFooter>
    </PopupBase>
  );
}
