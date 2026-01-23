import { useState, useEffect } from "react";
import { MessageCircle, Loader2, Send, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { sendWhatsAppMessage, formatWelcomeNewMember } from "@/lib/whatsapp";

interface Member {
  id: string;
  name: string;
  phone: string | null;
}

interface SendWelcomeWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member | null;
  clinicId: string;
  entityName: string;
  appUrl: string;
}

export function SendWelcomeWhatsAppDialog({
  open,
  onOpenChange,
  member,
  clinicId,
  entityName,
  appUrl,
}: SendWelcomeWhatsAppDialogProps) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Format phone number for display
  const formatPhoneInput = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  useEffect(() => {
    if (open && member) {
      setPhone(member.phone ? formatPhoneInput(member.phone) : "");
      setMessage(formatWelcomeNewMember(member.name, entityName, appUrl));
    }
  }, [open, member, entityName, appUrl]);

  const handleSend = async () => {
    if (!member) return;

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast({
        title: "Telefone inválido",
        description: "Por favor, informe um número de telefone válido.",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Mensagem vazia",
        description: "Por favor, digite uma mensagem.",
        variant: "destructive",
      });
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
        toast({
          title: "Mensagem enviada!",
          description: `Boas-vindas enviadas para ${member.name}`,
        });
        onOpenChange(false);
      } else {
        toast({
          title: "Erro ao enviar",
          description: result.error || "Não foi possível enviar a mensagem.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error sending welcome message:", error);
      toast({
        title: "Erro ao enviar",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-green-500/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-green-600" />
            </div>
            Enviar Boas-Vindas
          </DialogTitle>
          <DialogDescription>
            Envie uma mensagem de boas-vindas via WhatsApp para{" "}
            <strong>{member.name}</strong>, apresentando todos os benefícios e
            recursos disponíveis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone do associado</Label>
            <div className="relative">
              <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                placeholder="(00) 00000-0000"
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem de boas-vindas</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={16}
              className="text-sm font-mono resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Você pode personalizar a mensagem antes de enviar.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !phone.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar via WhatsApp
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
