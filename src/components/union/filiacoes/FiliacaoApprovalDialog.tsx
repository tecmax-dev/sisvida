import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle, Mail, MessageCircle } from "lucide-react";
import { syncAssociadoToPatient } from "@/lib/sync-associado-to-patient";

interface Props {
  filiacao: { id: string; nome: string; cpf: string } | null;
  action: "approve" | "reject";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function FiliacaoApprovalDialog({
  filiacao,
  action,
  open,
  onOpenChange,
  onComplete,
}: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);

  const isApprove = action === "approve";

  const handleSubmit = async () => {
    if (!filiacao || !user) return;

    if (!isApprove && !rejectReason.trim()) {
      toast({ title: "Informe o motivo da rejeição", variant: "destructive" });
      return;
    }

    setProcessing(true);
    try {
      const now = new Date().toISOString();

      if (isApprove) {
        // Generate matricula (registration number)
        const matricula = `${Date.now().toString().slice(-6)}`;

        // Update filiacao status (status must be 'ativo' per constraint)
        const updateData = {
          status: "ativo",
          aprovado_por: user.id,
          aprovado_at: now,
          matricula,
        };

        const { error: updateError } = await supabase
          .from("sindical_associados")
          .update(updateData)
          .eq("id", filiacao.id);

        if (updateError) throw updateError;

        // Sync to patients table so member appears in /union/socios
        try {
          const { data: assocData } = await supabase
            .from("sindical_associados")
            .select("sindicato_id")
            .eq("id", filiacao.id)
            .single();
          if (assocData?.sindicato_id) {
            const { data: ueData } = await supabase
              .from("union_entities")
              .select("clinic_id")
              .eq("id", assocData.sindicato_id)
              .single();
            if (ueData?.clinic_id) {
              await syncAssociadoToPatient(filiacao.id, ueData.clinic_id);
            }
          }
        } catch (syncErr) {
          console.error("Error syncing to patients:", syncErr);
        }

        // Automação: carteirinha de 30 dias + ficha na Central da empresa + pendência de ciência
        let automationNotice = "";
        try {
          const { data: proc, error: procErr } = await supabase.functions.invoke("affiliation-documents", {
            body: { action: "process", associadoId: filiacao.id },
          });
          automationNotice = procErr || !proc?.success
            ? "Automação pendente: reprocesse pela lista de filiações."
            : proc.status === "needs_employer"
              ? "Empresa não identificada: corrija o vínculo/CNPJ e reprocesse."
              : proc.errors?.length ? `Atenção: ${proc.errors.join("; ")}` : "Carteirinha e ficha da empresa geradas.";
        } catch {
          automationNotice = "Automação pendente: reprocesse pela lista de filiações.";
        }

        let whatsappNotice = "";
        if (sendWhatsApp) {
          const { data: result, error: notifError } = await supabase.functions.invoke("send-affiliation-welcome", {
            body: { associadoId: filiacao.id },
          });
          whatsappNotice = notifError ? "WhatsApp não enviado: falha ao consultar o serviço." : result?.success
            ? "Boas-vindas aceitas pela Meta para envio."
            : result?.reason === "TEMPLATE_NOT_APPROVED" ? "WhatsApp não enviado: modelo ainda não aprovado pela Meta."
            : result?.reason === "NO_CONSENT" ? "WhatsApp não enviado: falta autorização para este telefone."
            : result?.reason === "OPT_OUT" ? "WhatsApp não enviado: associado optou por não receber."
            : result?.reason === "ALREADY_ATTEMPTED" ? "WhatsApp não reenviado: tentativa já registrada."
            : "WhatsApp não enviado. Consulte a auditoria para mais detalhes.";
        }
        if (sendEmail) {
          const { error: emailError } = await supabase.functions.invoke("send-filiacao-notification", {
            body: { filiacaoId: filiacao.id, channel: "email" },
          });
          if (emailError) console.error("Error sending affiliation email", emailError);
        }

        toast({
          title: "Filiação aprovada com sucesso!",
          description: `Status atualizado e matrícula gerada. ${automationNotice} ${whatsappNotice}`,
        });
      } else {
        // Reject
        const { error: updateError } = await supabase
          .from("sindical_associados")
          .update({
            status: "rejeitado",
            rejeitado_por: user.id,
            rejeitado_at: now,
            motivo_rejeicao: rejectReason,
          })
          .eq("id", filiacao.id);

        if (updateError) throw updateError;

        // Send rejection notification
        if (sendEmail) {
          try {
            await supabase.functions.invoke("send-filiacao-notification", {
              body: {
                filiacaoId: filiacao.id,
                channel: "email",
                isRejection: true,
              },
            });
          } catch (notifError) {
            console.error("Error sending rejection email:", notifError);
          }
        }

        toast({ title: "Filiação rejeitada." });
      }

      onComplete();
    } catch (error: any) {
      console.error("Error processing filiacao:", error);
      toast({
        title: isApprove ? "Erro ao aprovar" : "Erro ao rejeitar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setRejectReason("");
      setSendEmail(true);
      setSendWhatsApp(true);
    }
    onOpenChange(newOpen);
  };

  if (!filiacao) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApprove ? (
              <>
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                Aprovar Filiação
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                Rejeitar Filiação
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-medium">{filiacao.nome}</p>
            <p className="text-sm text-muted-foreground font-mono">{filiacao.cpf}</p>
          </div>

          {isApprove ? (
            <>
              <p className="text-sm text-muted-foreground">
                Ao aprovar, o associado receberá a ficha de filiação e número de matrícula.
              </p>

              {/* Notification options */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Enviar notificação por:</p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="send-email"
                    checked={sendEmail}
                    onCheckedChange={(checked) => setSendEmail(checked === true)}
                  />
                  <Label htmlFor="send-email" className="flex items-center gap-2 cursor-pointer">
                    <Mail className="h-4 w-4" />
                    E-mail
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="send-whatsapp"
                    checked={sendWhatsApp}
                    onCheckedChange={(checked) => setSendWhatsApp(checked === true)}
                  />
                  <Label htmlFor="send-whatsapp" className="flex items-center gap-2 cursor-pointer">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Label>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="reject-reason">
                  Motivo da Rejeição <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="reject-reason"
                  placeholder="Informe o motivo da rejeição..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="send-rejection-email"
                  checked={sendEmail}
                  onCheckedChange={(checked) => setSendEmail(checked === true)}
                />
                <Label htmlFor="send-rejection-email" className="flex items-center gap-2 cursor-pointer text-sm">
                  <Mail className="h-4 w-4" />
                  Notificar o solicitante por e-mail
                </Label>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={processing}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={processing}
            className={isApprove ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            variant={isApprove ? "default" : "destructive"}
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : isApprove ? (
              <CheckCircle className="h-4 w-4 mr-2" />
            ) : (
              <XCircle className="h-4 w-4 mr-2" />
            )}
            {isApprove ? "Aprovar" : "Rejeitar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
