import { useState } from "react";
import { Mail, Loader2, Send, AlertTriangle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

interface SendAccessCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "accounting_office" | "employer";
  entityId: string;
  entityName: string;
  currentEmail: string;
  currentPhone?: string;
}

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export function SendAccessCodeDialog({
  open,
  onOpenChange,
  type,
  entityId,
  entityName,
  currentEmail,
  currentPhone = "",
}: SendAccessCodeDialogProps) {
  const { currentClinic } = useAuth();
  const [sendMethod, setSendMethod] = useState<"email" | "whatsapp">("email");
  const [email, setEmail] = useState(currentEmail);
  const [phone, setPhone] = useState(currentPhone);
  const [updateContact, setUpdateContact] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const isEmailDifferent = email.toLowerCase().trim() !== currentEmail.toLowerCase().trim();
  const isPhoneDifferent = phone.replace(/\D/g, "") !== currentPhone.replace(/\D/g, "");
  const isContactDifferent = sendMethod === "email" ? isEmailDifferent : isPhoneDifferent;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSendEmail = async () => {
    if (!email || !currentClinic) {
      toast.error("Email é obrigatório");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Email inválido");
      return;
    }

    const { data, error } = await supabase.functions.invoke("send-portal-access-code", {
      body: {
        type,
        entityId,
        recipientEmail: email.toLowerCase().trim(),
        recipientName: entityName,
        clinicName: currentClinic.name,
        clinicSlug: currentClinic.slug,
        updateEmail: isEmailDifferent && updateContact,
      },
    });

    if (error) throw error;
    return data;
  };

  const handleSendWhatsApp = async () => {
    if (!phone || !currentClinic) {
      toast.error("Telefone é obrigatório");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Telefone inválido");
      return;
    }

    const { data: codeData, error: codeError } = await supabase.functions.invoke("send-portal-access-code", {
      body: {
        type,
        entityId,
        recipientName: entityName,
        clinicName: currentClinic.name,
        clinicSlug: currentClinic.slug,
        updatePhone: isPhoneDifferent && updateContact,
        phone: cleanPhone,
        whatsappOnly: true,
      },
    });

    if (codeError) throw codeError;
    if (!codeData?.accessCode) throw new Error("Código de acesso não encontrado");

    const portalDomain = "https://app.eclini.com.br";
    
    const portalName = type === "accounting_office" ? "Portal do Contador" : "Portal da Empresa";
    const portalUrl = type === "accounting_office" 
      ? `${portalDomain}/portal-contador/${currentClinic.slug}`
      : `${portalDomain}/portal-empresa/${currentClinic.slug}`;
    
    const identifier = type === "accounting_office" 
      ? email 
      : codeData.identifier || "";

    const message = `🔑 *Código de Acesso - ${portalName}*

Olá *${entityName}*!

Segue seu código de acesso ao ${portalName} da ${currentClinic.name}:

📌 *Código:* ${codeData.accessCode}

📋 *Como acessar:*
1️⃣ Acesse: ${portalUrl}
2️⃣ Informe: ${identifier}
3️⃣ Digite o código acima

⚠️ Este código é pessoal e intransferível.

Atenciosamente,
Equipe ${currentClinic.name}`;

    const result = await sendWhatsAppMessage({
      phone: cleanPhone,
      message,
      clinicId: currentClinic.id,
      type: "custom",
    });

    if (!result.success) {
      throw new Error(result.error || "Erro ao enviar WhatsApp");
    }

    return result;
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      if (sendMethod === "email") {
        await handleSendEmail();
      } else {
        await handleSendWhatsApp();
      }

      toast.success(`Código de acesso enviado por ${sendMethod === "email" ? "e-mail" : "WhatsApp"}!`);
      
      if (isContactDifferent && updateContact) {
        toast.info(`${sendMethod === "email" ? "E-mail" : "Telefone"} atualizado no cadastro`);
      }
      
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending access code:", error);
      toast.error(error.message || "Erro ao enviar código de acesso");
    } finally {
      setIsSending(false);
    }
  };

  const portalName = type === "accounting_office" ? "Portal do Contador" : "Portal da Empresa";

  return (
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="md">
      <PopupHeader>
        <PopupTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          Enviar Código de Acesso
        </PopupTitle>
        <PopupDescription>
          Envie o código de acesso do {portalName} para <strong>{entityName}</strong>.
        </PopupDescription>
      </PopupHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-3">
          <Label>Método de envio</Label>
          <RadioGroup
            value={sendMethod}
            onValueChange={(value) => setSendMethod(value as "email" | "whatsapp")}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="email" id="email-method" />
              <Label htmlFor="email-method" className="flex items-center gap-2 cursor-pointer font-normal">
                <Mail className="h-4 w-4" />
                E-mail
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="whatsapp" id="whatsapp-method" />
              <Label htmlFor="whatsapp-method" className="flex items-center gap-2 cursor-pointer font-normal">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Label>
            </div>
          </RadioGroup>
        </div>

        {sendMethod === "email" ? (
          <div className="space-y-2">
            <Label htmlFor="email">E-mail do destinatário</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {currentEmail && (
              <p className="text-xs text-muted-foreground">
                E-mail cadastrado: {currentEmail}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="phone">WhatsApp do destinatário</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={handlePhoneChange}
            />
            {currentPhone && (
              <p className="text-xs text-muted-foreground">
                Telefone cadastrado: {formatPhone(currentPhone)}
              </p>
            )}
          </div>
        )}

        {isContactDifferent && (
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                O {sendMethod === "email" ? "e-mail" : "telefone"} informado é diferente do cadastrado.
              </p>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="updateContact"
                  checked={updateContact}
                  onCheckedChange={(checked) => setUpdateContact(checked === true)}
                />
                <label
                  htmlFor="updateContact"
                  className="text-sm font-medium text-amber-800 dark:text-amber-200 cursor-pointer"
                >
                  Atualizar {sendMethod === "email" ? "e-mail" : "telefone"} no cadastro
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <PopupFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
          Cancelar
        </Button>
        <Button 
          onClick={handleSend} 
          disabled={isSending || (sendMethod === "email" ? !email : !phone)}
        >
          {isSending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              {sendMethod === "email" ? (
                <Mail className="mr-2 h-4 w-4" />
              ) : (
                <MessageCircle className="mr-2 h-4 w-4" />
              )}
              Enviar Código
            </>
          )}
        </Button>
      </PopupFooter>
    </PopupBase>
  );
}
