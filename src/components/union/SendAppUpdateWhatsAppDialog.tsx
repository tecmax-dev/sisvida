import { useState, useEffect } from "react";
import { MessageCircle, Loader2, Send, Sparkles, Smartphone, Link2 } from "lucide-react";
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
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { useAuth } from "@/hooks/useAuth";

interface SendAppUpdateWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const APP_URL_SINDICATO = "https://prosinge.com.br/sindicato/baixar-app";

function generateAppUpdateMessage(): string {
  return `📲 *NOVIDADES NO APP DO SINDICATO!*

Olá! 👋

Temos o prazer de informar sobre as *novas funcionalidades* do nosso aplicativo para você, associado(a):

✨ *O QUE HÁ DE NOVO:*

📱 *Instalação PWA Simplificada*
Agora você pode instalar o app direto no celular, sem precisar baixar na loja!

🔔 *Notificar Carteirinha*
Nova função para receber lembretes sobre sua carteirinha digital.

💳 *Carteirinha Digital*
Acesse sua carteirinha a qualquer momento, diretamente no app.

📅 *Agendamento Online*
Marque suas consultas médicas, odontológicas e jurídicas pelo celular.

👥 *Gestão de Dependentes*
Cadastre e gerencie seus dependentes de forma prática.

🔐 *Sessão Permanente*
Fique conectado sem precisar fazer login toda vez!

━━━━━━━━━━━━━━━━━━━━

📥 *INSTALE AGORA:*

📱 *Link de Instalação:*
${APP_URL_SINDICATO}

━━━━━━━━━━━━━━━━━━━━

⚠️ *IMPORTANTE:*
• No iPhone, abra o link pelo *Safari*
• No Android, abra pelo *Chrome*
• Toque em "Adicionar à Tela Inicial"

Aproveite todas as novidades! 🎉

Atenciosamente,
*Sindicato dos Comerciários*`;
}

export function SendAppUpdateWhatsAppDialog({
  open,
  onOpenChange,
}: SendAppUpdateWhatsAppDialogProps) {
  const { toast } = useToast();
  const { currentClinic } = useAuth();
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

  // Get clean phone for preview
  const getCleanPhone = (): string => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return "";
    const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
    return `+${withCountry}`;
  };

  useEffect(() => {
    if (open) {
      setPhone("");
      setMessage(generateAppUpdateMessage());
    }
  }, [open]);

  const handleSend = async () => {
    if (!currentClinic?.id) {
      toast({
        title: "Erro",
        description: "Clínica não encontrada.",
        variant: "destructive",
      });
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast({
        title: "Telefone inválido",
        description: "Por favor, informe um número de telefone válido com DDD.",
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
      // Normalize phone - ensure 55 prefix
      const normalizedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
      
      console.log("[SendAppUpdate] Sending to:", normalizedPhone);
      
      const result = await sendWhatsAppMessage({
        phone: normalizedPhone,
        message,
        clinicId: currentClinic.id,
        type: "custom",
      });

      if (result.success) {
        toast({
          title: "Mensagem enviada!",
          description: `Atualização do app enviada para ${formatPhoneInput(phone)}`,
        });
        setPhone("");
        onOpenChange(false);
      } else {
        toast({
          title: "Erro ao enviar",
          description: result.error || "Não foi possível enviar a mensagem.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error sending app update message:", error);
      toast({
        title: "Erro ao enviar",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const cleanPhonePreview = getCleanPhone();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-white" />
            </div>
            Notificar Atualização do App
          </DialogTitle>
          <DialogDescription>
            Envie uma mensagem via WhatsApp informando sobre as novidades e link de instalação do aplicativo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Links de instalação */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="h-4 w-4 text-primary" />
              Links de Instalação
            </div>
            <div className="text-xs text-muted-foreground">
              <code className="bg-background px-1.5 py-0.5 rounded text-[10px]">{APP_URL_SINDICATO}</code>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Número do WhatsApp</Label>
            <div className="relative">
              <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                placeholder="(73) 99999-9999"
                className="pl-10"
                autoComplete="off"
              />
            </div>
            {cleanPhonePreview && (
              <p className="text-xs text-muted-foreground">
                Será enviado para: <strong className="text-foreground">{cleanPhonePreview}</strong>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem de Atualização</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={18}
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
