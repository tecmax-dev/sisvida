import { useState, useEffect } from "react";
import { MessageCircle, Mail, Loader2, Send, CheckCircle2, XCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

interface AccountingOffice {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  access_code?: string | null;
  is_active: boolean;
}

interface BulkSendAccessCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offices: AccountingOffice[];
}

interface SendResult {
  officeId: string;
  officeName: string;
  whatsappSuccess?: boolean;
  emailSuccess?: boolean;
  error?: string;
}

// Custom domain for portal
const PORTAL_DOMAIN = "https://app.eclini.com.br";

export function BulkSendAccessCodeDialog({
  open,
  onOpenChange,
  offices,
}: BulkSendAccessCodeDialogProps) {
  const { currentClinic } = useAuth();
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<string[]>([]);
  const [sendViaWhatsApp, setSendViaWhatsApp] = useState(true);
  const [sendViaEmail, setSendViaEmail] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SendResult[]>([]);
  const [messageDelay, setMessageDelay] = useState(10);

  // Filter only offices with access code and valid contact
  const eligibleOffices = offices.filter(o => 
    o.is_active && 
    o.access_code && 
    (o.phone || o.email)
  );

  const officesWithWhatsApp = eligibleOffices.filter(o => o.phone);
  const officesWithEmail = eligibleOffices.filter(o => o.email);

  useEffect(() => {
    if (open) {
      setSelectedOfficeIds([]);
      setResults([]);
      setProgress(0);
      fetchMessageDelay();
    }
  }, [open]);

  const fetchMessageDelay = async () => {
    if (!currentClinic?.id) return;
    
    try {
      const { data } = await supabase
        .from("clinics")
        .select("whatsapp_message_delay_seconds")
        .eq("id", currentClinic.id)
        .single();
      
      if (data?.whatsapp_message_delay_seconds) {
        setMessageDelay(data.whatsapp_message_delay_seconds);
      }
    } catch (error) {
      console.error("Error fetching message delay:", error);
    }
  };

  const handleSelectAll = () => {
    if (selectedOfficeIds.length === eligibleOffices.length) {
      setSelectedOfficeIds([]);
    } else {
      setSelectedOfficeIds(eligibleOffices.map(o => o.id));
    }
  };

  const toggleOffice = (officeId: string) => {
    setSelectedOfficeIds(prev =>
      prev.includes(officeId)
        ? prev.filter(id => id !== officeId)
        : [...prev, officeId]
    );
  };

  const getPortalUrl = () => {
    if (!currentClinic?.slug) return "";
    return `${PORTAL_DOMAIN}/portal-contador/${currentClinic.slug}`;
  };

  const sendWhatsAppToOffice = async (office: AccountingOffice): Promise<boolean> => {
    if (!office.phone || !currentClinic) return false;

    const cleanPhone = office.phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) return false;

    const portalUrl = getPortalUrl();
    
    const message = `🎉 *Novidade: Sistema eCLINI*

Olá *${office.name}*!

O *${currentClinic.name}* atualizou seu sistema de gestão de contribuições para o *eCLINI*.

A partir de agora, todos os boletos, consultas de empresas e serviços estarão disponíveis através do novo *Portal do Contador*.

🔑 *Seus dados de acesso:*

📧 *E-mail:* ${office.email}
📌 *Código:* ${office.access_code}

📋 *Como acessar:*
1️⃣ Acesse: ${portalUrl}
2️⃣ Informe seu e-mail
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

    return result.success;
  };

  const sendEmailToOffice = async (office: AccountingOffice): Promise<boolean> => {
    if (!office.email || !currentClinic) return false;

    try {
      const { error } = await supabase.functions.invoke("send-portal-access-code", {
        body: {
          type: "accounting_office",
          entityId: office.id,
          recipientEmail: office.email.toLowerCase().trim(),
          recipientName: office.name,
          clinicName: currentClinic.name,
          clinicSlug: currentClinic.slug,
        },
      });

      return !error;
    } catch {
      return false;
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleBulkSend = async () => {
    if (selectedOfficeIds.length === 0) {
      toast.error("Selecione pelo menos um escritório");
      return;
    }

    if (!sendViaWhatsApp && !sendViaEmail) {
      toast.error("Selecione pelo menos um método de envio");
      return;
    }

    setIsSending(true);
    setResults([]);
    setProgress(0);

    const selectedOffices = eligibleOffices.filter(o => selectedOfficeIds.includes(o.id));
    const newResults: SendResult[] = [];

    for (let i = 0; i < selectedOffices.length; i++) {
      const office = selectedOffices[i];
      const result: SendResult = {
        officeId: office.id,
        officeName: office.name,
      };

      try {
        // Send via WhatsApp if selected and office has phone
        if (sendViaWhatsApp && office.phone) {
          result.whatsappSuccess = await sendWhatsAppToOffice(office);
          
          // Apply delay between WhatsApp messages to prevent ban
          if (i < selectedOffices.length - 1 && sendViaWhatsApp) {
            await delay(messageDelay * 1000);
          }
        }

        // Send via Email if selected and office has email
        if (sendViaEmail && office.email) {
          result.emailSuccess = await sendEmailToOffice(office);
        }
      } catch (error: any) {
        result.error = error.message || "Erro desconhecido";
      }

      newResults.push(result);
      setResults([...newResults]);
      setProgress(Math.round(((i + 1) / selectedOffices.length) * 100));
    }

    // Summary
    const whatsappSuccess = newResults.filter(r => r.whatsappSuccess).length;
    const emailSuccess = newResults.filter(r => r.emailSuccess).length;
    const failed = newResults.filter(r => r.error || (!r.whatsappSuccess && !r.emailSuccess)).length;

    if (whatsappSuccess > 0 || emailSuccess > 0) {
      toast.success(`Enviado: ${whatsappSuccess} WhatsApp, ${emailSuccess} E-mails`);
    }
    if (failed > 0) {
      toast.warning(`${failed} envio(s) falharam`);
    }

    setIsSending(false);
  };

  const getResultIcon = (result: SendResult) => {
    if (result.whatsappSuccess || result.emailSuccess) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    if (result.error) {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    return null;
  };

  return (
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="lg">
      <PopupHeader>
        <PopupTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Envio em Lote - Códigos de Acesso
        </PopupTitle>
        <PopupDescription>
          Envie os códigos de acesso para múltiplos escritórios via WhatsApp e/ou E-mail.
        </PopupDescription>
      </PopupHeader>

      <div className="space-y-4 py-2">
          {/* Send Methods */}
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Enviar via:</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={sendViaWhatsApp}
                  onCheckedChange={(checked) => setSendViaWhatsApp(checked === true)}
                />
                <MessageCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">WhatsApp ({officesWithWhatsApp.length})</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={sendViaEmail}
                  onCheckedChange={(checked) => setSendViaEmail(checked === true)}
                />
                <Mail className="h-4 w-4 text-blue-600" />
                <span className="text-sm">E-mail ({officesWithEmail.length})</span>
              </label>
            </div>
          </div>

          {/* Selection Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedOfficeIds.length === eligibleOffices.length && eligibleOffices.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm font-medium">
                Selecionar todos ({eligibleOffices.length})
              </span>
            </div>
            <Badge variant="secondary">
              {selectedOfficeIds.length} selecionado(s)
            </Badge>
          </div>

          {/* Office List */}
          <ScrollArea className="h-[280px] border rounded-lg p-2">
            <div className="space-y-1">
              {eligibleOffices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum escritório elegível (necessário código de acesso e contato)
                </p>
              ) : (
                eligibleOffices.map((office) => {
                  const result = results.find(r => r.officeId === office.id);
                  return (
                    <div
                      key={office.id}
                      className={`flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 ${
                        selectedOfficeIds.includes(office.id) ? "bg-primary/5" : ""
                      }`}
                    >
                      <Checkbox
                        checked={selectedOfficeIds.includes(office.id)}
                        onCheckedChange={() => toggleOffice(office.id)}
                        disabled={isSending}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{office.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {office.phone && (
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3 text-green-600" />
                              {office.phone}
                            </span>
                          )}
                          {office.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-blue-600" />
                              {office.email.length > 25 
                                ? office.email.substring(0, 25) + "..." 
                                : office.email}
                            </span>
                          )}
                        </div>
                      </div>
                      {result && getResultIcon(result)}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Progress */}
          {isSending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Enviando...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Results Summary */}
          {results.length > 0 && !isSending && (
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <p className="font-medium mb-1">Resultado:</p>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {results.filter(r => r.whatsappSuccess || r.emailSuccess).length} enviado(s)
                </span>
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-4 w-4" />
                  {results.filter(r => !r.whatsappSuccess && !r.emailSuccess).length} falha(s)
                </span>
              </div>
            </div>
          )}
        </div>

      <PopupFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
          {results.length > 0 ? "Fechar" : "Cancelar"}
        </Button>
        <Button
          onClick={handleBulkSend}
          disabled={isSending || selectedOfficeIds.length === 0 || (!sendViaWhatsApp && !sendViaEmail)}
        >
          {isSending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Enviar ({selectedOfficeIds.length})
            </>
          )}
        </Button>
      </PopupFooter>
    </PopupBase>
  );
}
