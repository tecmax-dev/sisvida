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
import { Loader2, Mail, MessageSquare, KeyRound, AlertCircle, Copy, Check, Terminal } from "lucide-react";
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
  type LogEntry = { ts: string; level: "info" | "success" | "error" | "warn"; message: string; data?: unknown };
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [traceId, setTraceId] = useState<string | null>(null);

  const appendLog = (entry: Omit<LogEntry, "ts">) => {
    const ts = new Date().toISOString();
    setLogs((prev) => [...prev, { ...entry, ts }]);
    const tag = `[reset-password${traceId ? `:${traceId}` : ""}]`;
    const fn = entry.level === "error" ? console.error : entry.level === "warn" ? console.warn : console.log;
    if (entry.data !== undefined) fn(tag, entry.message, entry.data);
    else fn(tag, entry.message);
  };

  const copyLogs = async () => {
    const text = [
      `Trace ID: ${traceId ?? "-"}`,
      `Sócio: ${patient?.name} (${patient?.id})`,
      ...logs.map((l) => `[${l.ts}] [${l.level.toUpperCase()}] ${l.message}${l.data !== undefined ? ` :: ${JSON.stringify(l.data)}` : ""}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Logs copiados!");
    } catch {
      toast.error("Não foi possível copiar os logs");
    }
  };

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
    setLogs([]);
    setTraceId(null);
    onOpenChange(false);
  };

  const handleSend = async (channel: "email" | "whatsapp") => {
    if (!patient) return;

    setSelectedChannel(channel);
    setLoading(true);
    const newTraceId = `rst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setTraceId(newTraceId);
    setLogs([]);

    const t0 = performance.now();
    appendLog({ level: "info", message: `Iniciando envio (${channel})`, data: { patientId: patient.id, name: patient.name, email: patient.email, phone: patient.phone, traceId: newTraceId } });

    try {
      appendLog({ level: "info", message: "Chamando edge function admin-reset-patient-access" });
      const { data, error } = await supabase.functions.invoke("admin-reset-patient-access", {
        body: {
          patientId: patient.id,
          channel,
          traceId: newTraceId,
        },
      });

      const elapsed = Math.round(performance.now() - t0);
      appendLog({ level: "info", message: `Resposta recebida em ${elapsed}ms`, data: { error, data } });

      if (error) {
        appendLog({ level: "error", message: "Erro retornado pela edge function (transport)", data: error });
        throw error;
      }
      if (data?.error) {
        appendLog({ level: "error", message: "Erro retornado pela edge function (payload)", data: data });
        throw data;
      }

      appendLog({ level: "success", message: `Envio concluído com sucesso via ${channel}`, data });

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

      // Mantém o dialog aberto para o usuário poder copiar/inspecionar os logs
    } catch (err: unknown) {
      const parsedError = extractFunctionsError(err);
      console.error("Error sending patient reset:", err);
      appendLog({ level: "error", message: parsedError.message || "Erro desconhecido", data: { raw: err, parsed: parsedError } });
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

          {(logs.length > 0 || traceId) && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold">Log de envio</span>
                </div>
                <div className="flex items-center gap-2">
                  {traceId && (
                    <code className="text-[10px] bg-background px-2 py-1 rounded border">
                      {traceId}
                    </code>
                  )}
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={copyLogs}>
                    <Copy className="h-3 w-3 mr-1" /> Copiar
                  </Button>
                </div>
              </div>
              <div className="max-h-48 overflow-auto rounded bg-background border p-2 font-mono text-[11px] leading-relaxed space-y-1">
                {logs.map((l, i) => (
                  <div
                    key={i}
                    className={
                      l.level === "error"
                        ? "text-destructive"
                        : l.level === "success"
                        ? "text-emerald-600"
                        : l.level === "warn"
                        ? "text-amber-600"
                        : "text-foreground"
                    }
                  >
                    <span className="text-muted-foreground">[{l.ts.slice(11, 19)}]</span>{" "}
                    <span className="uppercase">[{l.level}]</span> {l.message}
                    {l.data !== undefined && (
                      <pre className="mt-0.5 text-[10px] text-muted-foreground whitespace-pre-wrap break-all">
                        {(() => { try { return JSON.stringify(l.data, null, 2); } catch { return String(l.data); } })()}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Use o Trace ID acima para localizar este envio nos logs do servidor.
              </p>
            </div>
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
