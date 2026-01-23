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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { formatCompetence } from "@/lib/competence-format";

interface Member {
  id: string;
  name: string;
  cpf: string | null;
  email?: string | null;
  phone?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
}

interface Contribution {
  id: string;
  value: number;
  due_date: string;
  status: string;
  competence_month: number;
  competence_year: number;
  lytex_invoice_id: string | null;
  lytex_invoice_url: string | null;
  lytex_boleto_digitable_line: string | null;
  lytex_pix_code: string | null;
  patients?: Member;
  contribution_types?: ContributionType;
}

interface SendPFContributionWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contribution: Contribution | null;
  clinicId: string;
  clinicName?: string;
}

export function SendPFContributionWhatsAppDialog({
  open,
  onOpenChange,
  contribution,
  clinicId,
  clinicName,
}: SendPFContributionWhatsAppDialogProps) {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const formatPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const generateDefaultMessage = () => {
    if (!contribution) return "";

    const memberName = contribution.patients?.name || "Associado";
    const competence = formatCompetence(contribution.competence_month, contribution.competence_year);
    const dueDate = format(new Date(contribution.due_date + "T12:00:00"), "dd/MM/yyyy");
    const value = formatCurrency(contribution.value);
    const typeName = contribution.contribution_types?.name || "Contribuição";

    let msg = `Olá ${memberName}! 👋

📋 *${typeName}*

━━━━━━━━━━━━━━━━
*Competência:* ${competence}
*Vencimento:* ${dueDate}
*Valor:* ${value}
━━━━━━━━━━━━━━━━`;

    if (contribution.lytex_invoice_url) {
      msg += `

🔗 *Acesse o boleto:*
${contribution.lytex_invoice_url}`;
    }

    if (contribution.lytex_pix_code) {
      msg += `

📱 *Código PIX (Copia e Cola):*
\`\`\`${contribution.lytex_pix_code}\`\`\``;
    }

    if (contribution.lytex_boleto_digitable_line) {
      msg += `

🔢 *Linha Digitável:*
${contribution.lytex_boleto_digitable_line}`;
    }

    msg += `

Atenciosamente,
${clinicName || "Entidade"}`;

    return msg;
  };

  useEffect(() => {
    if (open && contribution) {
      // Pre-fill phone if available
      if (contribution.patients?.phone) {
        setPhone(formatPhoneInput(contribution.patients.phone));
      } else {
        setPhone("");
      }
      setMessage(generateDefaultMessage());
    }
  }, [open, contribution]);

  const handleSend = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Digite um número de telefone válido");
      return;
    }

    if (!message.trim()) {
      toast.error("Digite uma mensagem");
      return;
    }

    setSending(true);
    try {
      const result = await sendWhatsAppMessage({
        phone: cleanPhone,
        message,
        clinicId,
        type: "custom",
      });

      if (result.success) {
        toast.success("Mensagem enviada com sucesso!");
        onOpenChange(false);
      } else {
        if (result.error?.includes("Limite") || result.error?.includes("limite")) {
          toast.error("📊 Limite de mensagens atingido! Faça upgrade do plano.");
        } else {
          toast.error(result.error || "Erro ao enviar mensagem");
        }
      }
    } catch (error: any) {
      console.error("Error sending WhatsApp:", error);
      toast.error(error.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            Enviar Contribuição via WhatsApp
          </DialogTitle>
          <DialogDescription>
            Envie os dados da contribuição para o sócio via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Número do WhatsApp</Label>
            <Input
              id="phone"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
              maxLength={16}
              disabled={sending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              className="font-mono text-sm"
              disabled={sending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || phone.replace(/\D/g, "").length < 10 || !message.trim()}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
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
