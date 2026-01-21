import { useState, useMemo } from "react";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import { formatCompetence } from "@/lib/competence-format";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContributionItem = any;

interface SendOverdueWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contributions: ContributionItem[];
  employerName: string;
  employerPhone: string | null;
  clinicId: string;
}

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

export function SendOverdueWhatsAppDialog({
  open,
  onOpenChange,
  contributions,
  employerName,
  employerPhone,
  clinicId,
}: SendOverdueWhatsAppDialogProps) {
  const [phone, setPhone] = useState(employerPhone || "");
  const [sending, setSending] = useState(false);
  const [customMessage, setCustomMessage] = useState("");

  const handleClose = () => onOpenChange(false);

  const overdueContributions = useMemo(() => {
    return contributions
      .filter((c) => c.status === "overdue" && c.lytex_invoice_url)
      .sort((a, b) => parseDateOnlyToLocalNoon(a.due_date).getTime() - parseDateOnlyToLocalNoon(b.due_date).getTime());
  }, [contributions]);

  const totalOverdue = overdueContributions.reduce((acc, c) => acc + c.value, 0);

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const buildMessage = () => {
    const today = new Date();
    let message = `⚠️ *AVISO DE PENDÊNCIAS*\n\n`;
    message += `Prezado(a) responsável,\n\n`;
    message += `Identificamos *${overdueContributions.length} contribuição(ões) em atraso* da empresa *${employerName}*:\n\n`;

    overdueContributions.forEach((c) => {
      const daysLate = differenceInDays(today, parseDateOnlyToLocalNoon(c.due_date));
      message += `📌 *${c.contribution_types?.name || "Contribuição"}*\n`;
      message += `   Competência: ${formatCompetence(c.competence_month, c.competence_year)}\n`;
      message += `   Vencimento: ${format(parseDateOnlyToLocalNoon(c.due_date), "dd/MM/yyyy")}\n`;
      message += `   Atraso: *${daysLate} dia(s)*\n`;
      message += `   Valor: *${formatCurrency(c.value)}*\n`;
      if (c.lytex_invoice_url) {
        message += `   🔗 ${c.lytex_invoice_url}\n`;
      }
      message += `\n`;
    });

    message += `💰 *Total em Atraso: ${formatCurrency(totalOverdue)}*\n\n`;
    
    if (customMessage) {
      message += `${customMessage}\n\n`;
    }

    message += `Pedimos a gentileza de regularizar as pendências o mais breve possível.\n\n`;
    message += `Em caso de dúvidas, estamos à disposição.`;

    return message;
  };

  const handleSend = async () => {
    if (!phone || overdueContributions.length === 0) {
      toast.error("Informe o número e verifique se há boletos vencidos");
      return;
    }

    setSending(true);
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

      const { error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          clinicId,
          phone: formattedPhone,
          message: buildMessage(),
        },
      });

      if (error) throw error;

      toast.success("Cobrança enviada com sucesso!");
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending:", error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  return (
    <PopupBase open={open} onClose={handleClose} maxWidth="lg">
      <PopupHeader>
        <PopupTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Cobrar Contribuições Vencidas
        </PopupTitle>
        <PopupDescription>
          Envie uma cobrança via WhatsApp para {employerName}
        </PopupDescription>
      </PopupHeader>

      <div className="space-y-4">
        {/* Summary */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-800">
                {overdueContributions.length} boleto(s) vencido(s)
              </p>
              <p className="text-xs text-amber-600">
                Total: {formatCurrency(totalOverdue)}
              </p>
            </div>
            <Badge className="bg-amber-500">Vencidos</Badge>
          </div>
        </div>

        {/* Overdue list */}
        <div className="max-h-[180px] overflow-y-auto space-y-2">
          {overdueContributions.map((c) => {
            const daysLate = differenceInDays(new Date(), parseDateOnlyToLocalNoon(c.due_date));
            return (
              <div
                key={c.id}
                className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
              >
                <div>
                  <p className="font-medium">{c.contribution_types?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCompetence(c.competence_month, c.competence_year)} • {daysLate} dias de atraso
                  </p>
                </div>
                <span className="font-medium text-amber-600">{formatCurrency(c.value)}</span>
              </div>
            );
          })}
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <Label className="text-sm">Número WhatsApp</Label>
          <Input
            placeholder="(00) 00000-0000"
            value={formatPhone(phone)}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          />
        </div>

        {/* Custom message */}
        <div className="space-y-1">
          <Label className="text-sm">Mensagem adicional (opcional)</Label>
          <Textarea
            placeholder="Ex: Favor entrar em contato para negociação..."
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <PopupFooter>
        <Button variant="outline" onClick={handleClose}>
          Cancelar
        </Button>
        <Button
          onClick={handleSend}
          disabled={sending || overdueContributions.length === 0}
          className="gap-2"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Enviar Cobrança
        </Button>
      </PopupFooter>
    </PopupBase>
  );
}
