import { Loader2, Ban, MessageCircle, UserX } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatProfessionalCancellation } from "@/lib/whatsapp";

interface BatchCancelDialogProps {
  batchCancelDialogOpen: boolean;
  setBatchCancelDialogOpen: (open: boolean) => void;
  batchSelectedIds: Set<string>;
  batchCancelReason: string;
  setBatchCancelReason: (v: string) => void;
  batchSendNotification: boolean;
  setBatchSendNotification: (v: boolean) => void;
  batchCancelling: boolean;
  handleBatchProfessionalCancel: () => void;
}

export function BatchCancelDialog({
  batchCancelDialogOpen, setBatchCancelDialogOpen, batchSelectedIds, batchCancelReason, setBatchCancelReason,
  batchSendNotification, setBatchSendNotification, batchCancelling, handleBatchProfessionalCancel,
}: BatchCancelDialogProps) {
  return (
      <AlertDialog open={batchCancelDialogOpen} onOpenChange={setBatchCancelDialogOpen}>
        <AlertDialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] overflow-hidden p-0 sm:max-w-lg">
          <AlertDialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6">
            <AlertDialogTitle className="flex items-start gap-2 text-left sm:items-center">
              <UserX className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600 sm:mt-0" />
              <span className="min-w-0">Cancelamento Profissional em Lote</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              Você está prestes a cancelar <strong>{batchSelectedIds.size} agendamento(s)</strong> por indisponibilidade do profissional. Os horários permanecerão bloqueados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[calc(90vh-11rem)] space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
            <div>
              <Label htmlFor="batch-cancel-reason">Motivo do cancelamento (opcional)</Label>
              <Textarea
                id="batch-cancel-reason"
                value={batchCancelReason}
                onChange={(e) => setBatchCancelReason(e.target.value)}
                placeholder="Informe o motivo do cancelamento..."
                className="mt-2"
                rows={3}
              />
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="batch-send-notification"
                checked={batchSendNotification}
                onCheckedChange={(checked) => setBatchSendNotification(!!checked)}
                className="mt-0.5"
              />
              <Label htmlFor="batch-send-notification" className="cursor-pointer text-sm font-normal leading-snug">
                Notificar pacientes via WhatsApp
              </Label>
            </div>

            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-950/20">
              <div className="flex items-start gap-2 text-sm text-orange-700 dark:text-orange-400">
                <Ban className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span className="font-medium leading-snug">Os horários permanecerão bloqueados</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Outros pacientes não poderão agendar nesses horários.
              </p>
            </div>
          </div>
          <AlertDialogFooter className="gap-2 px-4 pb-4 sm:px-6 sm:pb-6">
            <AlertDialogCancel 
              disabled={batchCancelling}
              className="mt-0 w-full whitespace-normal sm:w-auto"
              onClick={() => {
                setBatchCancelReason("");
                setBatchSendNotification(true);
              }}
            >
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchProfessionalCancel}
              className="h-auto w-full whitespace-normal bg-orange-600 py-2 text-white hover:bg-orange-700 sm:w-auto"
              disabled={batchCancelling}
            >
              {batchCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancelar {batchSelectedIds.size} agendamento(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
  );
}
