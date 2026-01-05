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
import { Loader2, Send, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  phone?: string | null;
}

interface NegotiationItem {
  contribution_type_name: string;
  competence_month: number;
  competence_year: number;
  original_value: number;
  total_value: number;
}

interface Negotiation {
  id: string;
  negotiation_code: string;
  status: string;
  total_original_value: number;
  total_negotiated_value: number;
  installments_count: number;
  installment_value: number;
  first_due_date: string;
  down_payment_value: number;
  applied_interest_rate: number;
  applied_correction_rate: number;
  applied_late_fee_rate: number;
  employers?: Employer;
}

interface SendNegotiationWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  negotiation: Negotiation;
  items: NegotiationItem[];
  clinicId: string;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function SendNegotiationWhatsAppDialog({
  open,
  onOpenChange,
  negotiation,
  items,
  clinicId,
}: SendNegotiationWhatsAppDialogProps) {
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open && negotiation.employers?.phone) {
      setPhone(formatPhone(negotiation.employers.phone));
    }
  }, [open, negotiation.employers?.phone]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
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

    setSending(true);

    try {
      // Build the negotiation summary message
      let message = `📋 *ESPELHO DE NEGOCIAÇÃO*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      message += `🏢 *Empresa:* ${negotiation.employers?.name || "N/A"}\n`;
      message += `📄 *CNPJ:* ${negotiation.employers?.cnpj ? formatCNPJ(negotiation.employers.cnpj) : "N/A"}\n`;
      message += `🔢 *Código:* ${negotiation.negotiation_code}\n\n`;

      message += `📝 *CONTRIBUIÇÕES NEGOCIADAS:*\n`;
      for (const item of items) {
        message += `• ${item.contribution_type_name} - ${MONTHS[item.competence_month - 1]}/${item.competence_year}\n`;
        message += `   Original: ${formatCurrency(item.original_value)} → Total: ${formatCurrency(item.total_value)}\n`;
      }

      message += `\n💰 *RESUMO FINANCEIRO:*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `Valor Original: ${formatCurrency(negotiation.total_original_value)}\n`;
      message += `*Valor Negociado: ${formatCurrency(negotiation.total_negotiated_value)}*\n\n`;

      message += `📅 *CONDIÇÕES:*\n`;
      if (negotiation.down_payment_value > 0) {
        message += `• Entrada: ${formatCurrency(negotiation.down_payment_value)}\n`;
      }
      message += `• Parcelas: ${negotiation.installments_count}x de ${formatCurrency(negotiation.installment_value)}\n`;
      message += `• 1ª Parcela: ${format(new Date(negotiation.first_due_date), "dd/MM/yyyy")}\n`;

      message += `\n📊 *TAXAS APLICADAS:*\n`;
      message += `• Juros: ${negotiation.applied_interest_rate}% a.m.\n`;
      message += `• Correção: ${negotiation.applied_correction_rate}% a.m.\n`;
      message += `• Multa: ${negotiation.applied_late_fee_rate}%\n`;

      message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      message += `_Proposta gerada em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}_`;

      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          phone: cleanPhone,
          message,
          clinicId,
          type: "custom",
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao enviar");

      toast.success("Espelho de negociação enviado com sucesso!");
      onOpenChange(false);
      setPhone("");
    } catch (error: any) {
      console.error("Erro ao enviar:", error);
      toast.error(error.message || "Erro ao enviar via WhatsApp");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            Enviar Espelho via WhatsApp
          </DialogTitle>
          <DialogDescription>
            Envie o resumo da negociação para o contribuinte.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Número do WhatsApp</Label>
            <Input
              id="phone"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={handlePhoneChange}
              maxLength={16}
            />
          </div>

          <div className="p-3 bg-muted rounded-md space-y-1 text-sm">
            <p><strong>Empresa:</strong> {negotiation.employers?.name}</p>
            <p><strong>Código:</strong> {negotiation.negotiation_code}</p>
            <p><strong>Valor:</strong> {formatCurrency(negotiation.total_negotiated_value)}</p>
            <p><strong>Parcelas:</strong> {negotiation.installments_count}x de {formatCurrency(negotiation.installment_value)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || phone.replace(/\D/g, "").length < 10}
            className="gap-2"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
