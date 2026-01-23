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
import { Loader2, Send, Mail } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
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

interface SendPFContributionEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contribution: Contribution | null;
  clinicId: string;
  clinicName?: string;
}

export function SendPFContributionEmailDialog({
  open,
  onOpenChange,
  contribution,
  clinicId,
  clinicName,
}: SendPFContributionEmailDialogProps) {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const generateDefaultContent = () => {
    if (!contribution) return { subject: "", message: "" };

    const memberName = contribution.patients?.name || "Associado";
    const competence = formatCompetence(contribution.competence_month, contribution.competence_year);
    const dueDate = format(new Date(contribution.due_date + "T12:00:00"), "dd/MM/yyyy");
    const value = formatCurrency(contribution.value);
    const typeName = contribution.contribution_types?.name || "Contribuição";

    const subj = `${typeName} - ${competence} | ${clinicName || "Sindicato"}`;

    let msg = `Prezado(a) ${memberName},

Segue abaixo os dados da sua contribuição:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ${typeName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Competência: ${competence}
📆 Vencimento: ${dueDate}
💰 Valor: ${value}
`;

    if (contribution.lytex_invoice_url) {
      msg += `

🔗 Link do Boleto:
${contribution.lytex_invoice_url}`;
    }

    if (contribution.lytex_boleto_digitable_line) {
      msg += `

🔢 Linha Digitável:
${contribution.lytex_boleto_digitable_line}`;
    }

    if (contribution.lytex_pix_code) {
      msg += `

📱 Código PIX (Copia e Cola):
${contribution.lytex_pix_code}`;
    }

    msg += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Atenciosamente,
${clinicName || "Entidade Sindical"}

---
Este é um e-mail automático. Em caso de dúvidas, entre em contato conosco.`;

    return { subject: subj, message: msg };
  };

  useEffect(() => {
    if (open && contribution) {
      // Pre-fill email if available
      if (contribution.patients?.email) {
        setEmail(contribution.patients.email);
      } else {
        setEmail("");
      }
      const content = generateDefaultContent();
      setSubject(content.subject);
      setMessage(content.message);
    }
  }, [open, contribution]);

  const handleSend = async () => {
    if (!email.trim() || !email.includes("@")) {
      toast.error("Digite um email válido");
      return;
    }

    if (!subject.trim()) {
      toast.error("Digite um assunto");
      return;
    }

    if (!message.trim()) {
      toast.error("Digite uma mensagem");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-contribution-email", {
        body: {
          to: email,
          subject,
          message,
          clinicId,
          contributionId: contribution?.id,
          memberName: contribution?.patients?.name,
        },
      });

      if (error) {
        console.error("Error sending email:", error);
        throw new Error(error.message || "Erro ao enviar email");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Email enviado com sucesso!");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Erro ao enviar email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            Enviar Contribuição por Email
          </DialogTitle>
          <DialogDescription>
            Envie os dados da contribuição para o sócio por email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email do Destinatário</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Assunto</Label>
            <Input
              id="subject"
              placeholder="Assunto do email"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
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
            disabled={sending || !email.includes("@") || !subject.trim() || !message.trim()}
            className="gap-2"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
