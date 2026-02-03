import { useState } from "react";
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
import { Loader2, MessageCircle, Mail, Send, FileText, Phone, Building2, User } from "lucide-react";
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
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [customMessage, setCustomMessage] = useState("");

  if (!appointment) return null;

  const formattedDate = format(
    new Date(appointment.appointment_date + "T12:00:00"),
    "dd 'de' MMMM 'de' yyyy",
    { locale: ptBR }
  );
  
  const baseMessage = type === "reminder" 
    ? formatReminderMessage(appointment as any) 
    : formatProtocolMessage(appointment as any);

  const handleSend = async () => {
    if (!sendWhatsApp && !sendEmail) {
      toast.error("Selecione pelo menos um canal de envio");
      return;
    }

    if (!currentClinic?.id) {
      toast.error("Clínica não encontrada");
      return;
    }

    setIsSending(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // Send via WhatsApp using Evolution API
      if (sendWhatsApp && appointment.company_phone) {
        const message = customMessage || baseMessage;
        const result = await sendWhatsAppViaEvolution(
          currentClinic.id,
          appointment.company_phone,
          message
        );
        
        await logHomologacaoNotification(
          appointment.id,
          currentClinic.id,
          "whatsapp",
          result.success ? "sent" : "failed",
          appointment.company_phone,
          undefined,
          message,
          result.error,
          type === "protocol"
        );
        
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          console.error("WhatsApp error:", result.error);
        }
      }

      // Send via Email
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
            customMessage || baseMessage,
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

      if (successCount > 0) {
        toast.success(`${type === "reminder" ? "Lembrete" : "Protocolo"} enviado com sucesso!`);
        onOpenChange(false);
      } else if (errorCount > 0) {
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
            Envie uma notificação para a empresa sobre o agendamento de homologação.
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

          {/* Contact Info */}
          <div className="space-y-2">
            <Label>Contatos disponíveis</Label>
            <div className="flex flex-wrap gap-2 text-sm">
              {appointment.company_phone && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Phone className="h-3 w-3 mr-1" />
                  {appointment.company_phone}
                </Badge>
              )}
              {appointment.company_email && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <Mail className="h-3 w-3 mr-1" />
                  {appointment.company_email}
                </Badge>
              )}
            </div>
          </div>

          {/* Channels Selection */}
          <div className="space-y-3">
            <Label>Canais de envio</Label>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="whatsapp"
                  checked={sendWhatsApp}
                  onCheckedChange={(checked) => setSendWhatsApp(checked as boolean)}
                  disabled={!appointment.company_phone}
                />
                <label
                  htmlFor="whatsapp"
                  className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  WhatsApp
                  {!appointment.company_phone && (
                    <span className="text-xs text-muted-foreground">(sem telefone)</span>
                  )}
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="email"
                  checked={sendEmail}
                  onCheckedChange={(checked) => setSendEmail(checked as boolean)}
                  disabled={!appointment.company_email}
                />
                <label
                  htmlFor="email"
                  className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  <Mail className="h-4 w-4 text-blue-600" />
                  E-mail
                  {!appointment.company_email && (
                    <span className="text-xs text-muted-foreground">(sem email)</span>
                  )}
                </label>
              </div>
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
          <Button onClick={handleSend} disabled={isSending || (!sendWhatsApp && !sendEmail)}>
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
