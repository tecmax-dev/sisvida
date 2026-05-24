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
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, MessageCircle, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { formatCompetence } from "@/lib/competence-format";
import { supabase } from "@/integrations/supabase/client";

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
  const [sendMode, setSendMode] = useState<"official" | "text">("official");
  const [lastResult, setLastResult] = useState<"success" | "error" | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

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
      setLastResult(null);
      setLastError(null);
      setSendMode(contribution.lytex_invoice_url ? "official" : "text");
    }
  }, [open, contribution]);

  const handleSendOfficial = async () => {
    if (!contribution) return;
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Digite um número de telefone válido");
      return;
    }
    if (!contribution.lytex_invoice_url) {
      toast.error("Boleto ainda não gerado. Gere o boleto antes de enviar via API Oficial.");
      return;
    }

    setSending(true);
    setLastResult(null);
    setLastError(null);

    try {
      const memberName =
        (contribution.patients?.name || "Associado").split(" ")[0] || "Associado";
      const typeName = contribution.contribution_types?.name || "Contribuição";
      const competence = formatCompetence(
        contribution.competence_month,
        contribution.competence_year
      );
      const ref = `${typeName} ${competence}`;
      const valueStr = formatCurrency(contribution.value).replace("R$", "R$").trim();
      const dueDate = format(
        new Date(contribution.due_date + "T12:00:00"),
        "dd/MM/yyyy"
      );

      const { data, error } = await supabase.functions.invoke("meta-send-template", {
        body: {
          to: cleanPhone,
          template_name: "boleto_mensalidade",
          language: "pt_BR",
          variables: [
            memberName,
            ref,
            valueStr,
            dueDate,
            contribution.lytex_invoice_url,
          ],
        },
      });

      if (error || !data?.success) {
        const msg =
          (data as any)?.error ||
          (error as any)?.message ||
          "Falha ao enviar via API Oficial. Verifique a configuração da Meta.";
        setLastResult("error");
        setLastError(msg);
        toast.error(msg);
        return;
      }

      setLastResult("success");
      toast.success("Boleto enviado via API Oficial do WhatsApp!");
      setTimeout(() => onOpenChange(false), 800);
    } catch (err: any) {
      console.error("Error sending via Meta Official:", err);
      const msg = err?.message || "Erro inesperado ao enviar via API Oficial";
      setLastResult("error");
      setLastError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const handleSendText = async () => {
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
    setLastResult(null);
    setLastError(null);
    try {
      const result = await sendWhatsAppMessage({
        phone: cleanPhone,
        message,
        clinicId,
        type: "custom",
      });

      if (result.success) {
        setLastResult("success");
        toast.success("Mensagem enviada com sucesso!");
        setTimeout(() => onOpenChange(false), 800);
      } else {
        setLastResult("error");
        setLastError(result.error || "Erro ao enviar mensagem");
        if (result.error?.includes("Limite") || result.error?.includes("limite")) {
          toast.error("📊 Limite de mensagens atingido! Faça upgrade do plano.");
        } else {
          toast.error(result.error || "Erro ao enviar mensagem");
        }
      }
    } catch (error: any) {
      console.error("Error sending WhatsApp:", error);
      setLastResult("error");
      setLastError(error?.message || "Erro ao enviar mensagem");
      toast.error(error.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => {
    if (sendMode === "official") return handleSendOfficial();
    return handleSendText();
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
          {/* Send mode selector */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={sendMode === "official" ? "default" : "outline"}
              onClick={() => setSendMode("official")}
              disabled={sending || !contribution?.lytex_invoice_url}
              className={
                sendMode === "official"
                  ? "bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                  : "gap-1.5"
              }
              title={
                !contribution?.lytex_invoice_url
                  ? "Boleto ainda não foi gerado"
                  : "Envia via template oficial aprovado pela Meta"
              }
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              API Oficial (Boleto)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sendMode === "text" ? "default" : "outline"}
              onClick={() => setSendMode("text")}
              disabled={sending}
              className={
                sendMode === "text"
                  ? "bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                  : "gap-1.5"
              }
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Mensagem livre
            </Button>
          </div>

          {sendMode === "official" && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4" />
                WhatsApp API Oficial — Template <Badge variant="secondary" className="ml-1">boleto_mensalidade</Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-emerald-800/90 dark:text-emerald-200/90">
                A mensagem usará o template aprovado pela Meta com os dados desta
                contribuição (nome, competência, valor, vencimento e link do boleto).
              </p>
            </div>
          )}

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

          {sendMode === "text" && (
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
              <p className="text-xs text-muted-foreground">
                Modo livre só funciona se houver janela de 24h aberta com o sócio.
              </p>
            </div>
          )}

          {lastResult === "success" && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2.5 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4" />
              Envio concluído com sucesso.
            </div>
          )}
          {lastResult === "error" && (
            <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-2.5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">{lastError || "Falha no envio"}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={
              sending ||
              phone.replace(/\D/g, "").length < 10 ||
              (sendMode === "text" && !message.trim()) ||
              (sendMode === "official" && !contribution?.lytex_invoice_url)
            }
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {sendMode === "official" ? "Enviar Boleto (API Oficial)" : "Enviar"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
