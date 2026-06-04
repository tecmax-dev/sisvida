import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StatusLog {
  id: string;
  created_at: string;
  phone: string;
  content: string | null;
  metadata: any;
}

export default function MetaWebhookHealthPage() {
  const [logs, setLogs] = useState<StatusLog[]>([]);
  const [lastStatusAt, setLastStatusAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_audit_logs")
      .select("id, created_at, phone, content, metadata")
      .eq("direction", "status")
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = (data ?? []) as StatusLog[];
    setLogs(rows);
    setLastStatusAt(rows[0] ? new Date(rows[0].created_at) : null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const minutesSince = lastStatusAt
    ? Math.floor((Date.now() - lastStatusAt.getTime()) / 60000)
    : null;
  const webhookHealthy = minutesSince !== null && minutesSince < 60;

  const statusColor = (s?: string) => {
    if (s === "delivered" || s === "read") return "default";
    if (s === "failed") return "destructive";
    return "secondary";
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Diagnóstico Webhook Meta</h1>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {!loading && (
        webhookHealthy ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Webhook saudável</AlertTitle>
            <AlertDescription>
              Último callback do Meta recebido há {minutesSince} min — entrega está sendo monitorada normalmente.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Webhook possivelmente caído</AlertTitle>
            <AlertDescription>
              {lastStatusAt
                ? `Nenhum status do Meta foi recebido há ${minutesSince} min (último em ${lastStatusAt.toLocaleString("pt-BR")}).`
                : "Nenhum status do Meta jamais foi recebido."}
              {" "}Verifique em business.facebook.com → WhatsApp Manager → Webhooks se o campo <b>messages</b> está subscrito e se o token de acesso continua válido.
            </AlertDescription>
          </Alert>
        )
      )}

      <Card>
        <CardHeader>
          <CardTitle>Últimos 50 status de entrega</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {logs.map((log) => {
              const status = log.metadata?.status ?? log.content ?? "—";
              const errors = log.metadata?.errors;
              return (
                <div key={log.id} className="flex items-center justify-between border-b py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <Badge variant={statusColor(status) as any}>{status}</Badge>
                    <span className="font-mono">{log.phone}</span>
                    {errors && (
                      <span className="text-destructive text-xs">
                        {Array.isArray(errors) ? errors[0]?.title ?? JSON.stringify(errors) : JSON.stringify(errors)}
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              );
            })}
            {logs.length === 0 && !loading && (
              <p className="text-muted-foreground text-sm">Nenhum status registrado.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}