import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Mail,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Send,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

interface SendUserWelcomeDialogProps {
  open: boolean;
  onClose: () => void;
  user: {
    user_id: string;
    email: string | null;
    name: string | null;
    phone: string | null;
  } | null;
  clinicId: string;
  clinicName: string;
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "");

  // Suporta números armazenados/colados com DDI 55 (ex.: 55 + DDD + número)
  // Regra: considerar DDI apenas quando houver mais de 11 dígitos totais.
  const hasCountryCode = digits.startsWith("55") && digits.length > 11;
  const national = (hasCountryCode ? digits.slice(2) : digits).slice(0, 11); // 10/11 dígitos (DDD+8/9)

  if (national.length === 0) return "";
  if (national.length <= 2) return hasCountryCode ? `+55 ${national}` : national;

  const ddd = national.slice(0, 2);
  const number = national.slice(2);

  if (number.length === 0) return hasCountryCode ? `+55 (${ddd})` : `(${ddd})`;
  if (number.length <= 4) {
    const partial = `(${ddd}) ${number}`;
    return hasCountryCode ? `+55 ${partial}` : partial;
  }

  const head = number.slice(0, -4);
  const tail = number.slice(-4);
  const formatted = `(${ddd}) ${head}-${tail}`;
  return hasCountryCode ? `+55 ${formatted}` : formatted;
}

function formatWelcomeMessage(
  userName: string,
  clinicName: string,
  email: string,
  tempPassword: string
): string {
  return `🎉 *Boas-vindas ao Sistema!*

Olá, *${userName}*!

Você recebeu acesso ao sistema da *${clinicName}*.

📧 *Seus dados de acesso:*
• Email: ${email}
• Senha temporária: ${tempPassword}

🔗 *Acesse agora:*
https://sisvida.lovable.app

⚠️ *Importante:* Por segurança, recomendamos que você altere sua senha no primeiro acesso.

Em caso de dúvidas, entre em contato com o administrador da clínica.`;
}

export function SendUserWelcomeDialog({
  open,
  onClose,
  user,
  clinicId,
  clinicName,
}: SendUserWelcomeDialogProps) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tempPassword, setTempPassword] = useState(generateTempPassword());
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  
  // Envio
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState("email");

  const whatsappPhoneDigits = phone.replace(/\D/g, "");
  const whatsappPhoneE164Preview = whatsappPhoneDigits
    ? whatsappPhoneDigits.startsWith("55")
      ? `+${whatsappPhoneDigits}`
      : `+55${whatsappPhoneDigits}`
    : "";

  useEffect(() => {
    if (open && user) {
      setEmail(user.email || "");
      setPhone(user.phone ? formatPhoneInput(user.phone) : "");
      const newPassword = generateTempPassword();
      setTempPassword(newPassword);
      setWhatsappMessage(
        formatWelcomeMessage(
          user.name || "Usuário",
          clinicName,
          user.email || "",
          newPassword
        )
      );
      setSendEmail(true);
      setSendWhatsApp(!!user.phone);
    }
  }, [open, user, clinicName]);

  const handleRegeneratePassword = () => {
    const newPassword = generateTempPassword();
    setTempPassword(newPassword);
    // Atualizar mensagem do WhatsApp com nova senha
    if (user) {
      setWhatsappMessage(
        formatWelcomeMessage(
          user.name || "Usuário",
          clinicName,
          email,
          newPassword
        )
      );
    }
  };

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    toast.success("Senha copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (!sendEmail && !sendWhatsApp) {
      toast.error("Selecione pelo menos um método de envio");
      return;
    }

    if (sendEmail && !email) {
      toast.error("Email é obrigatório para envio por email");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (sendWhatsApp && cleanPhone.length < 10) {
      toast.error("Telefone inválido para envio por WhatsApp");
      return;
    }

    setIsSending(true);

    try {
      const results: { email?: boolean; whatsapp?: boolean } = {};

      // Enviar por email
      if (sendEmail) {
        const { error: emailError } = await supabase.functions.invoke(
          "send-user-credentials",
          {
            body: {
              userEmail: email,
              userName: user.name || "Usuário",
              tempPassword,
              clinicName,
            },
          }
        );

        if (emailError) {
          console.error("Erro ao enviar email:", emailError);
          results.email = false;
        } else {
          results.email = true;
        }
      }

      // Enviar por WhatsApp
      if (sendWhatsApp) {
        try {
          // Normalizar telefone: garantir que tem DDI 55
          let phoneToSend = cleanPhone;
          if (!phoneToSend.startsWith("55")) {
            phoneToSend = `55${phoneToSend}`;
          }
          console.log("[SendUserWelcome] Enviando WhatsApp para:", phoneToSend, "(original:", cleanPhone, ")");
          
          const whatsappResult = await sendWhatsAppMessage({
            phone: phoneToSend,
            message: whatsappMessage,
            clinicId,
            type: "custom",
          });

          console.log("[SendUserWelcome] Resultado WhatsApp completo:", JSON.stringify(whatsappResult, null, 2));

          if (whatsappResult.success) {
            results.whatsapp = true;
            console.log("[SendUserWelcome] WhatsApp enviado com sucesso!");
          } else {
            console.error("[SendUserWelcome] Erro ao enviar WhatsApp:", whatsappResult.error);
            toast.error(`Erro WhatsApp: ${whatsappResult.error || "Falha no envio"}`);
            results.whatsapp = false;
          }
        } catch (whatsappError: any) {
          console.error("[SendUserWelcome] Exceção ao enviar WhatsApp:", whatsappError);
          toast.error(`Erro WhatsApp: ${whatsappError.message || "Erro inesperado"}`);
          results.whatsapp = false;
        }
      }

      // Resultado final
      const emailSuccess = !sendEmail || results.email;
      const whatsappSuccess = !sendWhatsApp || results.whatsapp;

      if (emailSuccess && whatsappSuccess) {
        const methods = [];
        if (sendEmail && results.email) methods.push("email");
        if (sendWhatsApp && results.whatsapp) methods.push("WhatsApp");
        if (methods.length > 0) {
          toast.success(`Boas-vindas enviadas com sucesso por ${methods.join(" e ")}!`);
        }
        handleClose();
      } else if (emailSuccess || whatsappSuccess) {
        // Pelo menos um funcionou
        if (sendEmail && results.email) {
          toast.success("Email enviado com sucesso!");
        }
        if (sendWhatsApp && results.whatsapp) {
          toast.success("WhatsApp enviado com sucesso!");
        }
        handleClose();
      } else {
        // Ambos falharam - toasts de erro já foram mostrados acima
        console.error("[SendUserWelcome] Todos os métodos falharam");
      }
    } catch (error: any) {
      console.error("Erro ao enviar boas-vindas:", error);
      toast.error(error.message || "Erro ao enviar boas-vindas");
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (!isSending) {
      onClose();
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            Enviar Boas-Vindas
          </DialogTitle>
          <DialogDescription>
            Envie as credenciais de acesso para{" "}
            <strong>{user.name || user.email}</strong> por email e/ou WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Métodos de envio */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-email"
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(checked === true)}
                disabled={isSending}
              />
              <Label htmlFor="send-email" className="flex items-center gap-1.5 cursor-pointer">
                <Mail className="h-4 w-4 text-blue-600" />
                Email
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-whatsapp"
                checked={sendWhatsApp}
                onCheckedChange={(checked) => setSendWhatsApp(checked === true)}
                disabled={isSending}
              />
              <Label htmlFor="send-whatsapp" className="flex items-center gap-1.5 cursor-pointer">
                <MessageCircle className="h-4 w-4 text-green-600" />
                WhatsApp
              </Label>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email" className="gap-1.5">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-1.5">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email do usuário</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="pl-10"
                    disabled={isSending}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="whatsapp" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone do usuário</Label>
                <div className="relative">
                  <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                    placeholder="(00) 00000-0000"
                    className="pl-10"
                    disabled={isSending}
                  />
                </div>
                {whatsappPhoneE164Preview ? (
                  <p className="text-xs text-muted-foreground">
                    Será enviado para: <span className="font-mono">{whatsappPhoneE164Preview}</span>
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp-message">Mensagem do WhatsApp</Label>
                <Textarea
                  id="whatsapp-message"
                  value={whatsappMessage}
                  onChange={(e) => setWhatsappMessage(e.target.value)}
                  rows={10}
                  className="text-sm font-mono resize-none"
                  disabled={isSending}
                />
                <p className="text-xs text-muted-foreground">
                  Você pode personalizar a mensagem antes de enviar.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Senha temporária */}
          <div className="space-y-2">
            <Label htmlFor="password">Senha temporária</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={tempPassword}
                  onChange={(e) => {
                    setTempPassword(e.target.value);
                    if (user) {
                      setWhatsappMessage(
                        formatWelcomeMessage(
                          user.name || "Usuário",
                          clinicName,
                          email,
                          e.target.value
                        )
                      );
                    }
                  }}
                  className="pr-10 font-mono"
                  disabled={isSending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSending}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleRegeneratePassword}
                disabled={isSending}
                title="Gerar nova senha"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyPassword}
                disabled={isSending}
                title="Copiar senha"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
            <AlertDescription className="text-sm">
              O usuário receberá as credenciais de acesso e um link para o sistema.
              Recomende que ele altere a senha no primeiro acesso.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSending || (!sendEmail && !sendWhatsApp)}
            className="gap-2"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar Boas-Vindas
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
