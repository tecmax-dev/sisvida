import { useState, useEffect } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Authorization {
  id: string;
  authorization_number: string;
  validation_hash: string;
  valid_from: string;
  valid_until: string;
  status: string;
  is_for_dependent: boolean;
  issued_at: string;
  patient: {
    id: string;
    name: string;
    cpf: string | null;
    phone?: string | null;
  };
  dependent?: {
    id: string;
    name: string;
  } | null;
  benefit: {
    id: string;
    name: string;
    partner_name: string | null;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorization: Authorization | null;
  clinicId: string;
  entityName?: string;
}

export function SendAuthorizationWhatsAppDialog({
  open,
  onOpenChange,
  authorization,
  clinicId,
  entityName,
}: Props) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);

  const beneficiaryName = authorization?.is_for_dependent
    ? authorization.dependent?.name
    : authorization?.patient?.name;

  const publicUrl = authorization
    ? `${window.location.origin}/autorizacao/validar/${authorization.validation_hash}`
    : "";

  const defaultMessage = authorization
    ? `Olá${beneficiaryName ? ` ${beneficiaryName.split(" ")[0]}` : ""}! 👋

Segue sua autorização de benefício:

📋 *Autorização Nº ${authorization.authorization_number}*
✅ Benefício: ${authorization.benefit?.name}
${authorization.benefit?.partner_name ? `🏥 Convênio: ${authorization.benefit.partner_name}\n` : ""}📅 Validade: ${format(new Date(authorization.valid_from), "dd/MM/yyyy", { locale: ptBR })} a ${format(new Date(authorization.valid_until), "dd/MM/yyyy", { locale: ptBR })}

🔗 Link para validação:
${publicUrl}

${entityName || "Atenciosamente"}`
    : "";

  useEffect(() => {
    if (open && authorization) {
      // Try to get phone from patient
      const patientPhone = authorization.patient?.phone || "";
      setPhone(formatPhone(patientPhone));
      setCustomMessage(defaultMessage);
    }
  }, [open, authorization]);

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    if (cleaned.length <= 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSend = async () => {
    if (!phone || !authorization) return;

    const cleanedPhone = phone.replace(/\D/g, "");
    if (cleanedPhone.length < 10) {
      toast({
        title: "Número inválido",
        description: "Digite um número de telefone válido com DDD.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const result = await sendWhatsAppMessage({
        phone: cleanedPhone,
        message: customMessage,
        clinicId,
      });

      if (result.success) {
        toast({
          title: "Autorização enviada!",
          description: "A mensagem foi enviada com sucesso via WhatsApp.",
        });
        onOpenChange(false);
      } else {
        throw new Error(result.error || "Erro ao enviar mensagem");
      }
    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description: error.message || "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (!authorization) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            Enviar Autorização via WhatsApp
          </DialogTitle>
          <DialogDescription>
            Envie a autorização {authorization.authorization_number} para o beneficiário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone WhatsApp</Label>
            <Input
              id="phone"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={handlePhoneChange}
              maxLength={16}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={10}
              className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={sending || !phone.trim()}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
