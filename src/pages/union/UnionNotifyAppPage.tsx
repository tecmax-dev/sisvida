import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { 
  Send, 
  Smartphone, 
  MessageCircle, 
  Loader2, 
  Link2, 
  Copy, 
  Check,
  Sparkles,
  Download,
  Bell,
  Users,
  Calendar,
  CreditCard
} from "lucide-react";

const APP_URL_SINDICATO = "https://app.eclini.com.br/sindicato/instalar";

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

const features = [
  { icon: Download, label: "Instalação PWA", description: "Instale direto no celular" },
  { icon: Bell, label: "Notificações", description: "Lembretes de carteirinha" },
  { icon: CreditCard, label: "Carteirinha Digital", description: "Acesso rápido" },
  { icon: Calendar, label: "Agendamento Online", description: "Consultas pelo app" },
  { icon: Users, label: "Dependentes", description: "Gestão simplificada" },
];

export default function UnionNotifyAppPage() {
  const { toast } = useToast();
  const { currentClinic } = useAuth();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(generateAppUpdateMessage());
  const [sending, setSending] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

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

  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(link);
      toast({ title: "Link copiado!", description: "Cole onde preferir." });
      setTimeout(() => setCopiedLink(null), 2000);
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
    }
  };

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

  const handleResetMessage = () => {
    setMessage(generateAppUpdateMessage());
    toast({ title: "Mensagem restaurada", description: "Texto padrão restaurado." });
  };

  const cleanPhonePreview = getCleanPhone();

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg">
            <Smartphone className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Notificar Atualização do App</h1>
            <p className="text-muted-foreground">
              Envie mensagens sobre as novidades do aplicativo via WhatsApp
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Card - Message Composer */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                  Enviar Notificação
                </CardTitle>
                <CardDescription>
                  Digite o número do associado e personalize a mensagem
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Número do WhatsApp</Label>
                  <div className="relative">
                    <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                      placeholder="(73) 99999-9999"
                      className="pl-10 text-lg"
                      autoComplete="off"
                    />
                  </div>
                  {cleanPhonePreview && (
                    <p className="text-sm text-muted-foreground">
                      Será enviado para: <strong className="text-foreground">{cleanPhonePreview}</strong>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="message">Mensagem</Label>
                    <Button variant="ghost" size="sm" onClick={handleResetMessage}>
                      <Sparkles className="h-3 w-3 mr-1" />
                      Restaurar Padrão
                    </Button>
                  </div>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={20}
                    className="text-sm font-mono resize-none"
                  />
                </div>

                <Button
                  onClick={handleSend}
                  disabled={sending || !phone.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 h-12 text-base"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-2" />
                      Enviar via WhatsApp
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Links and Features */}
          <div className="space-y-4">
            {/* Installation Links */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" />
                  Link de Instalação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">App do Sindicato</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={APP_URL_SINDICATO} 
                      readOnly 
                      className="text-xs h-9"
                    />
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleCopyLink(APP_URL_SINDICATO)}
                      className="shrink-0"
                    >
                      {copiedLink === APP_URL_SINDICATO ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Features Highlight */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Novidades do App
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {features.map((feature, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <feature.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{feature.label}</p>
                        <p className="text-xs text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
      </div>
    </div>
  );
}
