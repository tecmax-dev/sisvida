import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export function FocusIntegrationPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testConnection = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("focus-api-health", {
      });
      if (error) throw error;
      setResult(data);
      if (data?.ok) toast.success("Focus API respondeu com sucesso.");
      else toast.error(data?.reason || (data?.status === "timeout" ? "A Focus API excedeu o tempo limite." : data?.status === "misconfigured" ? "A integração Focus não está configurada." : `Focus API respondeu HTTP ${data?.status ?? "desconhecido"}.`));
    } catch (error: any) {
      setResult({ ok: false, reason: error.message || "Falha no teste" });
      toast.error("Não foi possível testar a Focus API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Focus API</CardTitle>
        <CardDescription>Casa das Antenas · diagnóstico protegido no servidor. Credenciais nunca são exibidas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result && (
          <div className="flex items-start gap-3 rounded-lg border p-4">
            {result.ok ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <XCircle className="h-5 w-5 text-destructive" />}
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2"><Badge variant={result.ok ? "default" : "destructive"}>{result.ok ? "Conectada" : result.status === "timeout" ? "Tempo esgotado" : result.status === "misconfigured" ? "Não configurada" : "Falha"}</Badge>{typeof result.status === "number" && <span>HTTP {result.status}</span>}</div>
              <p className="text-muted-foreground">Latência: {result.latency_ms ?? "—"} ms · ID: {result.correlation_id ?? "—"}</p>
              {result.reason && <p className="text-destructive">{result.reason}</p>}
            </div>
          </div>
        )}
        <Button onClick={testConnection} disabled={loading} className="focus-visible:ring-2 focus-visible:ring-ring">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
          {loading ? "Testando…" : "Testar conexão"}
        </Button>
      </CardContent>
    </Card>
  );
}
