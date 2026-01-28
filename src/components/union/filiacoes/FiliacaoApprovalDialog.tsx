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
  const { user, currentClinic } = useAuth();
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
        // Fetch full filiacao data for patient creation
        const { data: filiacaoData, error: fetchError } = await supabase
          .from("sindical_associados")
          .select("*, sindicato:sindicato_id(clinic_id)")
          .eq("id", filiacao.id)
          .single();

        if (fetchError) throw fetchError;

        const clinicId = filiacaoData.sindicato?.clinic_id || currentClinic?.id;

        if (!clinicId) {
          throw new Error("Clínica não encontrada para criar o cadastro do associado");
        }

        // Generate matricula (registration number)
        const matricula = `${Date.now().toString().slice(-6)}`;

        // Create patient record in the clinic's patient database
        const { data: newPatient, error: patientError } = await supabase
          .from("patients")
          .insert({
            clinic_id: clinicId,
            name: filiacaoData.nome,
            cpf: filiacaoData.cpf,
            email: filiacaoData.email || null,
            phone: filiacaoData.telefone || null,
            birth_date: filiacaoData.data_nascimento || null,
            gender: filiacaoData.sexo || null,
            street: filiacaoData.logradouro || null,
            street_number: filiacaoData.numero || null,
            neighborhood: filiacaoData.bairro || null,
            city: filiacaoData.cidade || null,
            state: filiacaoData.uf || null,
            cep: filiacaoData.cep || null,
            registration_number: matricula,
            tag: "ativo",
            notes: `Filiação aprovada em ${new Date().toLocaleDateString("pt-BR")}. Cargo: ${filiacaoData.cargo || "-"}`,
          })
          .select("id")
          .single();

        if (patientError) {
          // Check if it's a duplicate CPF error
          if (patientError.code === "23505") {
            // CPF already exists, just update the filiacao
            console.log("Patient already exists, updating filiacao status only");
          } else {
            throw patientError;
          }
        }

        // Update filiacao status
        const updateData: any = {
          status: "aprovado",
          aprovado_por: user.id,
          aprovado_at: now,
          matricula,
        };

        // Link patient_id if created
        if (newPatient?.id) {
          updateData.patient_id = newPatient.id;
        }

        const { error: updateError } = await supabase
          .from("sindical_associados")
          .update(updateData)
          .eq("id", filiacao.id);

        if (updateError) throw updateError;

        // Send notifications
        if (sendEmail || sendWhatsApp) {
          const channels = [];
          if (sendEmail) channels.push("email");
          if (sendWhatsApp) channels.push("whatsapp");

          for (const channel of channels) {
            try {
              await supabase.functions.invoke("send-filiacao-notification", {
                body: {
                  filiacaoId: filiacao.id,
                  channel,
                },
              });
            } catch (notifError) {
              console.error(`Error sending ${channel} notification:`, notifError);
            }
          }
        }

        toast({ 
          title: "Filiação aprovada com sucesso!",
          description: "Associado cadastrado na base de sócios da entidade.",
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
