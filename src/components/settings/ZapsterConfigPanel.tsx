import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ShieldCheck, RefreshCw, Webhook, Check, AlertCircle, Loader2 } from "lucide-react";
import { ZapsterWebhookLogsPanel } from "./ZapsterWebhookLogsPanel";

interface ZapsterInstance {
  id: string;
  name?: string;
  status?: string;
  phone_number?: string;
}

interface Props {
  clinicId: string;
}

export function ZapsterConfigPanel({ clinicId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [instances, setInstances] = useState<ZapsterInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [config, setConfig] = useState<{
    instance_id: string | null;
    phone_number: string | null;
    webhook_id: string | null;
    is_connected: boolean;
  } | null>(null);

  useEffect(() => {
    void loadAll();
  }, [clinicId]);

  async function loadAll() {
    setLoading(true);
    try {
      const { data: cfg } = await supabase
        .from("zapster_configs")
        .select("instance_id, phone_number, webhook_id, is_connected")
        .eq("clinic_id", clinicId)
        .maybeSingle();

      setConfig(cfg);
      if (cfg?.instance_id) setSelectedInstanceId(cfg.instance_id);

      const { data, error } = await supabase.functions.invoke("zapster-list-instances");
      if (error) throw error;
      const list: ZapsterInstance[] = (data?.instances as ZapsterInstance[]) || [];
      setInstances(list);
    } catch (e: unknown) {
      console.error("[zapster-config] load error", e);
      toast({
        title: "Erro ao carregar",
        description: e instanceof Error ? e.message : "Falha ao listar instâncias",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveInstance() {
    if (!selectedInstanceId) return;
    setBusy(true);
    try {
      const inst = instances.find((i) => i.id === selectedInstanceId);
      const { error } = await supabase
        .from("zapster_configs")
        .upsert(
          {
            clinic_id: clinicId,
            instance_id: selectedInstanceId,
            phone_number: inst?.phone_number || null,
            is_active: true,
            is_connected: inst?.status === "connected",
          },
          { onConflict: "clinic_id" }
        );
      if (error) throw error;
      toast({ title: "Instância salva", description: "Agora ative o webhook." });
      await loadAll();
    } catch (e: unknown) {
      toast({
        title: "Erro ao salvar",
        description: e instanceof Error ? e.message : "Falha",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function setupWebhook() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("zapster-setup-webhook", {
        body: { clinicId },
      });
      if (error) throw error;
      toast({
        title: "Webhook configurado",
        description: `URL: ${data?.webhook_url || "ok"}`,
      });
      await loadAll();
    } catch (e: unknown) {
      toast({
        title: "Erro ao configurar webhook",
        description: e instanceof Error ? e.message : "Falha",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-500" />
          Zap Responder — Configuração da Instância
        </CardTitle>
        <CardDescription>
          Selecione qual número (instância) do Zap Responder será usado por esta clínica e
          ative o webhook para receber mensagens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando instâncias...
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Instância (número)</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedInstanceId}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
                disabled={busy}
              >
                <option value="">Selecione...</option>
                {instances.map((i) => (
                  <option key={i.id} value={i.id}>
                    {(i.name || i.id) + (i.phone_number ? ` — ${i.phone_number}` : "")}
                    {i.status ? ` [${i.status}]` : ""}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={saveInstance}
                  disabled={busy || !selectedInstanceId || selectedInstanceId === config?.instance_id}
                >
                  Salvar instância
                </Button>
                <Button size="sm" variant="outline" onClick={loadAll} disabled={busy}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
                </Button>
              </div>
            </div>

            {config?.instance_id && (
              <div className="rounded-md border p-3 bg-muted/30 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {config.is_connected ? (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <Check className="h-3 w-3 mr-1" /> Conectado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      <AlertCircle className="h-3 w-3 mr-1" /> Desconectado
                    </Badge>
                  )}
                  {config.phone_number && (
                    <span className="text-muted-foreground">📞 {config.phone_number}</span>
                  )}
                </div>
                <div>
                  <strong>Instance ID:</strong>{" "}
                  <code className="text-xs">{config.instance_id}</code>
                </div>
                <div className="flex items-center gap-2">
                  <strong>Webhook:</strong>{" "}
                  {config.webhook_id ? (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <Check className="h-3 w-3 mr-1" /> Ativo ({config.webhook_id.slice(0, 8)}…)
                    </Badge>
                  ) : (
                    <Badge variant="outline">Não configurado</Badge>
                  )}
                </div>
                <Button size="sm" variant="secondary" onClick={setupWebhook} disabled={busy}>
                  <Webhook className="h-4 w-4 mr-1" />
                  {config.webhook_id ? "Atualizar webhook" : "Ativar webhook (recebimento)"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
    {config?.instance_id && <ZapsterWebhookLogsPanel clinicId={clinicId} />}
    </div>
  );
}
