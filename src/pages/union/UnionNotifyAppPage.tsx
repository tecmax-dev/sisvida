import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  CreditCard,
  Globe,
  QrCode,
  Apple,
  Chrome,
  Info,
  FileText,
  ExternalLink,
  Zap,
  Shield,
  RefreshCw
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
  { icon: Download, label: "Instalação PWA", description: "Sem loja de apps" },
  { icon: Bell, label: "Notificações", description: "Lembretes automáticos" },
  { icon: CreditCard, label: "Carteirinha", description: "Acesso digital" },
  { icon: Calendar, label: "Agendamento", description: "Online 24h" },
  { icon: Users, label: "Dependentes", description: "Gestão completa" },
  { icon: Shield, label: "Sessão", description: "Login permanente" },
];

const installSteps = {
  ios: [
    { step: 1, text: "Abra o link no Safari", icon: Globe },
    { step: 2, text: "Toque no ícone de compartilhar", icon: ExternalLink },
    { step: 3, text: "Selecione 'Adicionar à Tela Inicial'", icon: Smartphone },
  ],
  android: [
    { step: 1, text: "Abra o link no Chrome", icon: Chrome },
    { step: 2, text: "Toque no menu (⋮)", icon: Info },
    { step: 3, text: "Selecione 'Instalar aplicativo'", icon: Download },
  ],
};

export default function UnionNotifyAppPage() {
  const { toast } = useToast();
  const { currentClinic } = useAuth();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(generateAppUpdateMessage());
  const [sending, setSending] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState("enviar");

  const formatPhoneInput = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const getCleanPhone = (): string => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return "";
    const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
    return `+${withCountry}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(APP_URL_SINDICATO);
      setCopiedLink(true);
      toast({ title: "Link copiado!", description: "Cole onde preferir." });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
    }
  };

  const handleSend = async () => {
    if (!currentClinic?.id) {
      toast({ title: "Erro", description: "Clínica não encontrada.", variant: "destructive" });
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast({ title: "Telefone inválido", description: "Informe um número válido com DDD.", variant: "destructive" });
      return;
    }

    if (!message.trim()) {
      toast({ title: "Mensagem vazia", description: "Digite uma mensagem.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const normalizedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
      const result = await sendWhatsAppMessage({
        phone: normalizedPhone,
        message,
        clinicId: currentClinic.id,
        type: "custom",
      });

      if (result.success) {
        toast({ title: "Enviado!", description: `Mensagem enviada para ${formatPhoneInput(phone)}` });
        setPhone("");
      } else {
        toast({ title: "Erro ao enviar", description: result.error || "Tente novamente.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error sending:", error);
      toast({ title: "Erro", description: "Erro inesperado. Tente novamente.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleResetMessage = () => {
    setMessage(generateAppUpdateMessage());
    toast({ title: "Restaurado", description: "Texto padrão restaurado." });
  };

  const cleanPhonePreview = getCleanPhone();

  return (
    <div className="space-y-4">
      {/* Header Compacto */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
            <Smartphone className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Notificar Atualização do App</h1>
            <p className="text-sm text-muted-foreground">
              Envie instruções de instalação via WhatsApp
            </p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1">
          <Zap className="h-3 w-3" />
          PWA
        </Badge>
      </div>

      {/* Link Rápido */}
      <Card className="border-dashed">
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Link2 className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Link de Instalação</p>
              <p className="text-sm font-mono truncate">{APP_URL_SINDICATO}</p>
            </div>
            <Button size="sm" variant="outline" onClick={handleCopyLink} className="shrink-0">
              {copiedLink ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              <span className="ml-1.5 hidden sm:inline">{copiedLink ? "Copiado" : "Copiar"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-9">
          <TabsTrigger value="enviar" className="text-xs">
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Enviar
          </TabsTrigger>
          <TabsTrigger value="recursos" className="text-xs">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Recursos
          </TabsTrigger>
          <TabsTrigger value="instalacao" className="text-xs">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Instalação
          </TabsTrigger>
        </TabsList>

        {/* Tab: Enviar Notificação */}
        <TabsContent value="enviar" className="space-y-4 mt-4">
          <div className="grid gap-4 lg:grid-cols-5">
            {/* Form */}
            <Card className="lg:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  Enviar via WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs">Número do WhatsApp</Label>
                  <div className="relative">
                    <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                      placeholder="(73) 99999-9999"
                      className="pl-10 h-9"
                      autoComplete="off"
                    />
                  </div>
                  {cleanPhonePreview && (
                    <p className="text-xs text-muted-foreground">
                      Enviar para: <span className="font-medium text-foreground">{cleanPhonePreview}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="message" className="text-xs">Mensagem</Label>
                    <Button variant="ghost" size="sm" onClick={handleResetMessage} className="h-6 text-xs px-2">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Restaurar
                    </Button>
                  </div>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={14}
                    className="text-xs font-mono resize-none"
                  />
                </div>

                <Button
                  onClick={handleSend}
                  disabled={sending || !phone.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 h-10"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Notificação
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Quick Info */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    Modelo de Mensagem
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    A mensagem inclui automaticamente:
                  </p>
                  <ul className="text-xs space-y-1">
                    <li className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-green-500" />
                      Lista de novos recursos
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-green-500" />
                      Link de instalação
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-green-500" />
                      Instruções por plataforma
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-green-500" />
                      Formatação WhatsApp
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="h-4 w-4 text-amber-500" />
                    Dicas de Envio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li>• Confirme o número antes de enviar</li>
                    <li>• Personalize a mensagem se necessário</li>
                    <li>• Aguarde confirmação de envio</li>
                    <li>• Use para novos associados</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Recursos do App */}
        <TabsContent value="recursos" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recursos Disponíveis</CardTitle>
              <CardDescription className="text-xs">
                Funcionalidades incluídas no aplicativo do associado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {features.map((feature, index) => (
                  <div 
                    key={index}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors text-center"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">{feature.label}</p>
                      <p className="text-[10px] text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Instruções de Instalação */}
        <TabsContent value="instalacao" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* iOS */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Apple className="h-5 w-5" />
                  iPhone / iPad
                </CardTitle>
                <CardDescription className="text-xs">
                  Instalação via Safari
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {installSteps.ios.map((item) => (
                    <div key={item.step} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                      <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                        {item.step}
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{item.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Android */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Chrome className="h-5 w-5 text-green-600" />
                  Android
                </CardTitle>
                <CardDescription className="text-xs">
                  Instalação via Chrome
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {installSteps.android.map((item) => (
                    <div key={item.step} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                      <div className="h-6 w-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {item.step}
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{item.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Info Extra */}
          <Card className="mt-4 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30">
            <CardContent className="py-3">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    O que é PWA?
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
                    Progressive Web App é uma tecnologia que permite instalar o site como um aplicativo, 
                    sem precisar baixar da loja. Funciona offline e recebe atualizações automáticas.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
