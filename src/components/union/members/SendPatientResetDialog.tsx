import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, MessageSquare, KeyRound, AlertCircle, Copy, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { extractFunctionsError } from "@/lib/functionsError";

interface SendPatientResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
}

export function SendPatientResetDialog({
  open,
  onOpenChange,
  patient,
}: SendPatientResetDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<"email" | "whatsapp" | null>(null);
  const [copied, setCopied] = useState(false);

  const resetLink = patient?.email
    ? `${window.location.origin}/sindicato/recuperar-senha?email=${encodeURIComponent(patient.email)}`
    : null;

  const handleCopyResetLink = async () => {
    if (!resetLink) return;
    try {
      await navigator.clipboard.writeText(resetLink);
      setCopied(true);
      toast.success("Link copiado!", { description: "Cole e envie manualmente para o associado" });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = resetLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleClose = () => {
    setSelectedChannel(null);
    onOpenChange(false);
  };

  const handleSend = async (channel: "email" | "whatsapp") => {
    if (!patient) return;

    setSelectedChannel(channel);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-patient-access", {
        body: {
          patientId: patient.id,
          channel,
        },
      });

      if (error) throw error;
      if (data?.error) throw data;

      toast.success(
        channel === "email"
          ? "Código de recuperação enviado por e-mail!"
          : "Link de recuperação enviado por WhatsApp!",
        {
          description: channel === "email"
            ? `Enviado para ${patient.email}`
            : `Enviado para ${patient.phone || "telefone cadastrado"}`,
        }
      );

      handleClose();
    } catch (err: unknown) {
      const parsedError = extractFunctionsError(err);
      console.error("Error sending patient reset:", err);
      toast.error(parsedError.message || "Erro ao enviar código de recuperação");
    } finally {
      setLoading(false);
      setSelectedChannel(null);
    }
  };

  const hasNoContact = !patient?.email && !patient?.phone;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Reset de Senha do App
          </DialogTitle>
          <DialogDescription>
            Enviar código de recuperação de senha para{" "}
            <span className="font-medium text-foreground">{patient?.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {patient?.email && (
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={patient.email} disabled className="bg-muted" />
            </div>
          )}

          {patient?.phone && (
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={patient.phone} disabled className="bg-muted" />
            </div>
          )}

          {hasNoContact && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Associado não possui e-mail nem telefone cadastrado. Não é possível enviar o código.
              </AlertDescription>
            </Alert>
          )}

          {!hasNoContact && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                className="h-20 flex flex-col gap-2 border-2 hover:border-primary hover:bg-primary/5"
                onClick={() => handleSend("email")}
                disabled={loading || !patient?.email}
              >
                {loading && selectedChannel === "email" ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : (
                  <Mail className="h-6 w-6 text-primary" />
                )}
                <span className="text-sm font-medium">Enviar por E-mail</span>
              </Button>

              <Button
                variant="outline"
                className="h-20 flex flex-col gap-2 border-2 hover:border-emerald-500 hover:bg-emerald-500/5"
                onClick={() => handleSend("whatsapp")}
                disabled={loading || !patient?.phone}
              >
                {loading && selectedChannel === "whatsapp" ? (
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                ) : (
                  <MessageSquare className="h-6 w-6 text-emerald-500" />
                )}
                <span className="text-sm font-medium">Enviar por WhatsApp</span>
              </Button>
            </div>
          )}

          {!patient?.email && patient?.phone && (
            <p className="text-xs text-muted-foreground text-center">
              E-mail indisponível: associado sem e-mail cadastrado
            </p>
          )}

          {patient?.email && !patient?.phone && (
            <p className="text-xs text-muted-foreground text-center">
              WhatsApp indisponível: associado sem telefone cadastrado
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
