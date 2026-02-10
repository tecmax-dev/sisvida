import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, Mail, Send, FileText, Phone, Building2, User, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  formatReminderMessage,
  formatProtocolMessage,
  logHomologacaoNotification,
  sendWhatsAppViaEvolution,
} from "@/lib/homologacaoUtils";

interface HomologacaoAppointment {
  id: string;
  employee_name: string;
  employee_cpf?: string | null;
  company_name: string;
  company_cnpj?: string | null;
  company_phone: string;
  company_email?: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes?: string | null;
  protocol_number?: string | null;
  professional?: {
    id: string;
    name: string;
  } | null;
  service_type?: {
    id: string;
    name: string;
    duration_minutes: number;
  } | null;
}

interface PartyContact {
  label: string;
  icon: React.ReactNode;
  phone?: string | null;
  email?: string | null;
  enabled: boolean;
}

interface HomologacaoSendNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: HomologacaoAppointment | null;
  type: "reminder" | "protocol";
}

export function HomologacaoSendNotificationDialog({
  open,
  onOpenChange,
  appointment,
  type,
}: HomologacaoSendNotificationDialogProps) {
  const { currentClinic } = useAuth();
  const [sendEmail, setSendEmail] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  
  // Individual party selection
  const [sendToCompany, setSendToCompany] = useState(true);
  const [sendToManager, setSendToManager] = useState(true);
  const [sendToProfessional, setSendToProfessional] = useState(true);
  
  // Fetched contacts
  const [managerPhone, setManagerPhone] = useState<string | null>(null);
  const [professionalPhone, setProfessionalPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch manager and professional phone when dialog opens
  useEffect(() => {
    if (!open || !currentClinic?.id || !appointment) return;
    
    setLoading(true);
    
    const fetchContacts = async () => {
      try {
        // Fetch manager WhatsApp from homologacao_settings
        const { data: settings } = await supabase
          .from("homologacao_settings")
          .select("manager_whatsapp")
          .eq("clinic_id", currentClinic.id)
          .maybeSingle();
        
        setManagerPhone(settings?.manager_whatsapp || null);

        // Fetch professional phone if professional is assigned
        if (appointment.professional?.id) {
          const { data: prof } = await supabase
            .from("homologacao_professionals")
            .select("phone")
            .eq("id", appointment.professional.id)
            .maybeSingle();
          
          setProfessionalPhone(prof?.phone || null);
        } else {
          setProfessionalPhone(null);
        }
      } catch (err) {
        console.error("Error fetching contacts:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [open, currentClinic?.id, appointment]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setCustomMessage("");
      setSendToCompany(true);
      setSendToManager(true);
      setSendToProfessional(true);
      setSendEmail(true);
    }
  }, [open]);

  if (!appointment) return null;

  const formattedDate = format(
    new Date(appointment.appointment_date + "T12:00:00"),
    "dd 'de' MMMM 'de' yyyy",
    { locale: ptBR }
  );
  
  const baseMessage = type === "reminder" 
    ? formatReminderMessage(appointment as any) 
    : formatProtocolMessage(appointment as any);

  const parties: { key: string; label: string; icon: React.ReactNode; phone: string | null; checked: boolean; setChecked: (v: boolean) => void }[] = [
    {
      key: "company",
      label: "Empresa",
      icon: <Building2 className="h-4 w-4 text-green-600" />,
      phone: appointment.company_phone || null,
      checked: sendToCompany,
      setChecked: setSendToCompany,
    },
    {
      key: "manager",
      label: "Gestor",
      icon: <ShieldCheck className="h-4 w-4 text-blue-600" />,
      phone: managerPhone,
      checked: sendToManager,
      setChecked: setSendToManager,
    },
    {
      key: "professional",
      label: "Profissional",
      icon: <User className="h-4 w-4 text-purple-600" />,
      phone: professionalPhone,
      checked: sendToProfessional,
      setChecked: setSendToProfessional,
    },
  ];

  const hasAnySelected = parties.some(p => p.checked && p.phone) || (sendEmail && appointment.company_email);

  const handleSend = async () => {
    if (!hasAnySelected) {
      toast.error("Selecione pelo menos um destinatário");
      return;
    }

    if (!currentClinic?.id) {
      toast.error("Clínica não encontrada");
      return;
    }

    setIsSending(true);
    let successCount = 0;
    let errorCount = 0;
    const message = customMessage || baseMessage;

    try {
      // Send WhatsApp to selected parties
      for (const party of parties) {
        if (!party.checked || !party.phone) continue;

        const partyMessage = customMessage || (
          type === "reminder"
            ? formatReminderMessage(appointment as any, party.key as any)
            : formatProtocolMessage(appointment as any)
        );

        const result = await sendWhatsAppViaEvolution(
          currentClinic.id,
          party.phone,
          partyMessage
        );

        await logHomologacaoNotification(
          appointment.id,
          currentClinic.id,
          "whatsapp",
          result.success ? "sent" : "failed",
          party.phone,
          undefined,
          partyMessage,
          result.error,
          type === "protocol"
        );

        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          console.error(`WhatsApp error (${party.label}):`, result.error);
        }

        // Small delay between sends
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Send via Email to company
      if (sendEmail && appointment.company_email) {
        try {
          const { error } = await supabase.functions.invoke("send-homologacao-email", {
            body: {
              appointment_id: appointment.id,
              type,
              custom_message: customMessage || undefined,
            },
          });

          if (error) throw error;

          await logHomologacaoNotification(
            appointment.id,
            currentClinic.id,
            "email",
            "sent",
            undefined,
            appointment.company_email,
            message,
            undefined,
            type === "protocol"
          );
          successCount++;
        } catch (err: any) {
          console.error("Email error:", err);
          await logHomologacaoNotification(
            appointment.id,
            currentClinic.id,
            "email",
            "failed",
            undefined,
            appointment.company_email,
            undefined,
            err.message
          );
          errorCount++;
        }
      }

      if (successCount > 0 && errorCount === 0) {
        toast.success(`${type === "reminder" ? "Lembrete" : "Protocolo"} enviado com sucesso! (${successCount} envio${successCount > 1 ? "s" : ""})`);
        onOpenChange(false);
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(`${successCount} enviado(s), ${errorCount} falha(s)`);
        onOpenChange(false);
      } else {
        toast.error("Falha ao enviar notificação");
      }
    } catch (err) {
      console.error("Send error:", err);
      toast.error("Erro ao enviar notificação");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "reminder" ? (
              <>
                <MessageCircle className="h-5 w-5 text-primary" />
                Enviar Lembrete
              </>
            ) : (
              <>
                <FileText className="h-5 w-5 text-primary" />
                Enviar Protocolo
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Selecione as partes que receberão a notificação via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Appointment Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{appointment.employee_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>{appointment.company_name}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary">{formattedDate}</Badge>
              <Badge variant="secondary">{appointment.start_time?.slice(0, 5)}</Badge>
              {appointment.protocol_number && (
                <Badge variant="outline" className="bg-primary/10">
                  <FileText className="h-3 w-3 mr-1" />
                  {appointment.protocol_number}
                </Badge>
              )}
            </div>
          </div>

          {/* WhatsApp Recipients */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-green-600" />
              Destinatários WhatsApp
            </Label>
            
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando contatos...
              </div>
            ) : (
              <div className="space-y-2 pl-1">
                {parties.map((party) => (
                  <div key={party.key} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`party-${party.key}`}
                        checked={party.checked}
                        onCheckedChange={(checked) => party.setChecked(checked as boolean)}
                        disabled={!party.phone}
                      />
                      <label
                        htmlFor={`party-${party.key}`}
                        className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {party.icon}
                        {party.label}
                      </label>
                    </div>
                    {party.phone ? (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        <Phone className="h-3 w-3 mr-1" />
                        {party.phone}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">sem telefone</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Email (company only) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              E-mail
            </Label>
            <div className="flex items-center justify-between pl-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="email"
                  checked={sendEmail}
                  onCheckedChange={(checked) => setSendEmail(checked as boolean)}
                  disabled={!appointment.company_email}
                />
                <label
                  htmlFor="email"
                  className="flex items-center gap-2 text-sm font-medium leading-none"
                >
                  <Building2 className="h-4 w-4 text-blue-600" />
                  Empresa
                </label>
              </div>
              {appointment.company_email ? (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  <Mail className="h-3 w-3 mr-1" />
                  {appointment.company_email}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground italic">sem email</span>
              )}
            </div>
          </div>

          {/* Custom Message (optional) */}
          <div className="space-y-2">
            <Label htmlFor="customMessage">
              Mensagem personalizada (opcional)
            </Label>
            <Textarea
              id="customMessage"
              placeholder="Deixe em branco para usar a mensagem padrão..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Se não informar, será usada a mensagem padrão do sistema.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={isSending || !hasAnySelected}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
