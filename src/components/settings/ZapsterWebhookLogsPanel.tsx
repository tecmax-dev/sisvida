import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, ScrollText, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

interface LogRow {
  id: string;
  created_at: string;
  event_type: string;
  event_id: string | null;
  status: string;
  summary: string | null;
  sender: string | null;
  message_preview: string | null;
  forwarded_status: number | null;
  forwarded_response: string | null;
  error_message: string | null;
  payload: unknown;
}

interface Props {
  clinicId: string;
}

const STATUS_VARIANT: Record<string, { label: string; className: string }> = {
  forwarded: { label: "Encaminhado", className: "text-green-700 border-green-600 bg-green-50" },
  received: { label: "Recebido", className: "text-blue-700 border-blue-600 bg-blue-50" },
  ignored: { label: "Ignorado", className: "text-muted-foreground" },
  error: { label: "Erro", className: "text-red-700 border-red-600 bg-red-50" },
};

export function ZapsterWebhookLogsPanel({ clinicId }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("zapster_webhook_logs")
        .select(
          "id, created_at, event_type, event_id, status, summary, sender, message_preview, forwarded_status, forwarded_response, error_message, payload"
        )
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      setRows((data as LogRow[]) || []);
    } catch (e) {
      console.error("[zapster-logs] load error", e);
    } finally {
      setLoading(false);
    }
  }, [clinicId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`zapster-logs-${clinicId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "zapster_webhook_logs", filter: `clinic_id=eq.${clinicId}` },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clinicId, load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" />
          Logs do Webhook Zap Responder
        </CardTitle>
        <CardDescription>
          Últimos 100 eventos recebidos. Atualiza em tempo real conforme novos eventos chegam.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todos os status</option>
            <option value="forwarded">Encaminhados</option>
            <option value="received">Recebidos</option>
            <option value="ignored">Ignorados</option>
            <option value="error">Erros</option>
          </select>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {rows.length} {rows.length === 1 ? "evento" : "eventos"}
          </span>
        </div>

        {loading && rows.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando logs...
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8 border rounded-md">
            Nenhum evento registrado ainda. Quando o Zap Responder enviar eventos para o webhook, eles aparecerão aqui.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[140px]">Quando</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[140px]">Tipo</TableHead>
                  <TableHead>Resumo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const isOpen = expanded === r.id;
                  const v = STATUS_VARIANT[r.status] || STATUS_VARIANT.received;
                  return (
                    <>
                      <TableRow
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => setExpanded(isOpen ? null : r.id)}
                      >
                        <TableCell>
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={v.className}>
                            {v.label}
                            {r.forwarded_status ? ` ${r.forwarded_status}` : ""}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs">{r.event_type}</code>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.summary || "—"}
                          {r.sender && <span className="text-xs text-muted-foreground block">de {r.sender}</span>}
                          {r.message_preview && (
                            <span className="text-xs italic text-muted-foreground block truncate max-w-md">
                              "{r.message_preview}"
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow key={`${r.id}-d`}>
                          <TableCell colSpan={5} className="bg-muted/30">
                            <div className="space-y-2 text-xs">
                              {r.error_message && (
                                <div>
                                  <strong className="text-red-600">Erro:</strong> {r.error_message}
                                </div>
                              )}
                              {r.forwarded_response && (
                                <div>
                                  <strong>Resposta whatsapp-webhook:</strong>
                                  <pre className="mt-1 p-2 rounded bg-background border overflow-x-auto">
                                    {r.forwarded_response}
                                  </pre>
                                </div>
                              )}
                              <div>
                                <strong>Payload completo:</strong>
                                <pre className="mt-1 p-2 rounded bg-background border overflow-x-auto max-h-80">
                                  {JSON.stringify(r.payload, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
