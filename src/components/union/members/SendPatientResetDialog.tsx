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
import { Loader2, Mail, MessageSquare, KeyRound, AlertCircle, Copy, Check, Smartphone } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { extractFunctionsErrorAsync } from "@/lib/functionsError";

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
  const [selectedChannel, setSelectedChannel] = useState<"email" | "whatsapp" | "sms" | null>(null);
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
    setCopied(false);
    onOpenChange(false);
  };

  const handleSend = async (channel: "email" | "whatsapp" | "sms") => {
    if (!patient) return;

    setSelectedChannel(channel);
    setLoading(true);
    const newTraceId = `rst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error("Sessão expirada — faça login novamente");
      }

      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const anonKey = (supabase as any).supabaseKey as string;
      const url = `${supabaseUrl}/functions/v1/admin-reset-patient-access`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          patientId: patient.id,
          channel,
          traceId: newTraceId,
        }),
      });

      const rawText = await response.text();
      let data: any = null;
      try { data = rawText ? JSON.parse(rawText) : null; } catch { data = rawText; }

      if (!response.ok) {
        const serverMessage =
          (data && typeof data === "object" && (data.error || data.message)) ||
          (typeof data === "string" && data) ||
          `Erro HTTP ${response.status}`;
        const err: any = new Error(serverMessage);
        err.status = response.status;
        err.body = data;
        throw err;
      }

      if (data && typeof data === "object" && data.error) {
        const err: any = new Error(data.error);
        err.status = response.status;
        err.body = data;
        throw err;
      }

      const usedFallback = data && typeof data === "object" && data.fallback === true && data.channel === "email";

      if (usedFallback) {
        toast.success("Código enviado por e-mail (fallback automático)", {
          description: `WhatsApp indisponível para este número. Código enviado para ${patient.email}.`,
          duration: 8000,
        });
      } else {
        const channelLabel =
          channel === "email" ? "e-mail" : channel === "sms" ? "SMS" : "WhatsApp";
        toast.success(`Código de recuperação enviado por ${channelLabel}!`, {
          description:
            channel === "email"
              ? `Enviado para ${patient.email}`
              : `Enviado para ${patient.phone || "telefone cadastrado"}`,
        });
        handleClose();
      }
    } catch (err: unknown) {
      const parsedError = await extractFunctionsErrorAsync(err);
      console.error("Error sending patient reset:", err);
      const directMsg = (err as any)?.message;
      const msg = String(directMsg || parsedError.message || "");
      const isAuth =
        msg.toLowerCase().includes("unauthorized") ||
        msg.toLowerCase().includes("não autenticado") ||
        msg.includes("401") ||
        (typeof (err as { status?: number })?.status === "number" && (err as { status?: number }).status === 401);
      toast.error(
        isAuth
          ? "Sessão expirada — faça login novamente para reenviar o reset"
          : (msg || "Erro ao enviar código de recuperação")
      );
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

          {resetLink && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Compartilhamento manual (copie e envie por qualquer canal):
              </p>
              <div className="flex gap-2">
                <Input
                  value={resetLink}
                  readOnly
                  className="text-xs bg-background"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={handleCopyResetLink}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {!hasNoContact && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
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
                <span className="text-sm font-medium">E-mail</span>
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
                <span className="text-sm font-medium">WhatsApp</span>
              </Button>

              <Button
                variant="outline"
                className="h-20 flex flex-col gap-2 border-2 hover:border-blue-500 hover:bg-blue-500/5"
                onClick={() => handleSend("sms")}
                disabled={loading || !patient?.phone}
              >
                {loading && selectedChannel === "sms" ? (
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                ) : (
                  <Smartphone className="h-6 w-6 text-blue-500" />
                )}
                <span className="text-sm font-medium">SMS</span>
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
