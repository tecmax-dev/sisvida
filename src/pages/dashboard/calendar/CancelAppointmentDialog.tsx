import { Loader2, Ban, MessageCircle, UserX } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatProfessionalCancellation } from "@/lib/whatsapp";

interface CancelAppointmentDialogProps {
  cancelDialogOpen: boolean;
  setCancelDialogOpen: (open: boolean) => void;
  cancelReason: string;
  setCancelReason: (v: string) => void;
  cancelByProfessional: boolean;
  setCancelByProfessional: (v: boolean) => void;
  sendCancelNotification: boolean;
  setSendCancelNotification: (v: boolean) => void;
  cancellingAppointment: any;
  setCancellingAppointment: (apt: any) => void;
  currentClinic: { name: string } | null | undefined;
  saving: boolean;
  handleCancelAppointment: () => void;
}

export function CancelAppointmentDialog({
  cancelDialogOpen, setCancelDialogOpen, cancelReason, setCancelReason, cancelByProfessional, setCancelByProfessional,
  sendCancelNotification, setSendCancelNotification, cancellingAppointment, setCancellingAppointment, currentClinic, saving, handleCancelAppointment,
}: CancelAppointmentDialogProps) {
  return (
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="cancel-reason">Motivo do cancelamento (opcional)</Label>
              <Textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Informe o motivo do cancelamento..."
                className="mt-2"
                rows={3}
              />
            </div>
            
            {/* Checkbox: Cancelamento pelo profissional */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="cancel-by-professional"
                checked={cancelByProfessional}
                onCheckedChange={(checked) => setCancelByProfessional(!!checked)}
              />
              <Label htmlFor="cancel-by-professional" className="text-sm font-normal cursor-pointer">
                Profissional não poderá atender
              </Label>
            </div>

            {/* Checkbox: Enviar notificação WhatsApp */}
            {cancelByProfessional && (
              <div className="flex items-center space-x-2 ml-6">
                <Checkbox
                  id="send-notification"
                  checked={sendCancelNotification}
                  onCheckedChange={(checked) => setSendCancelNotification(!!checked)}
                />
                <Label htmlFor="send-notification" className="text-sm font-normal text-muted-foreground cursor-pointer">
                  Notificar paciente via WhatsApp
                </Label>
              </div>
            )}

            {/* Info: Horário permanece bloqueado */}
            {cancelByProfessional && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm">
                  <Ban className="h-4 w-4" />
                  <span className="font-medium">O horário permanecerá bloqueado</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Outros pacientes não poderão agendar neste horário.
                </p>
              </div>
            )}

            {/* Preview da mensagem */}
            {cancelByProfessional && sendCancelNotification && cancellingAppointment && currentClinic && (
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium mb-2">
                  <MessageCircle className="h-4 w-4" />
                  Prévia da mensagem
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                  {formatProfessionalCancellation(
                    cancellingAppointment.patient?.name || 'Paciente',
                    currentClinic.name,
                    new Date(cancellingAppointment.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR'),
                    cancellingAppointment.start_time.slice(0, 5),
                    cancellingAppointment.professional?.name || 'o profissional',
                    cancelReason.trim() || undefined,
                    (cancellingAppointment as any).dependent?.name || null
                  )}
                </p>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setCancellingAppointment(null);
              setCancelReason("");
              setCancelByProfessional(false);
              setSendCancelNotification(true);
            }}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelAppointment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
  );
}
