import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, Activity, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SafeConfig {
  safe_mode: boolean;
  maintenance_mode: boolean;
  dry_run: boolean;
  max_per_hour: number;
  max_per_day: number;
  max_per_contact_30d: number;
  circuit_breaker_open: boolean;
  circuit_reason: string | null;
  go_live_stage: number;
  manual_override: boolean;
}

const STAGE_LABEL: Record<number, string> = {
  0: "Desligado",
  1: "Semana 1 (≤20 contatos/24h)",
  2: "Semana 2 (≤100 contatos/24h)",
  3: "Semana 3 (≤500 contatos/24h)",
  4: "Liberação total",
};

const HEALTH_COLOR: Record<string, string> = {
  excellent: "bg-green-500",
  attention: "bg-yellow-500",
  risk: "bg-orange-500",
  critical: "bg-red-500",
  suspend: "bg-red-700",
};

export function MetaSafeModePanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SafeConfig | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [reason, setReason] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-safe-mode-admin", { method: "GET" as any });
      if (error) throw error;
      setConfig(data?.config ?? null);
      setHealth(data?.health ?? null);
      setAudit(data?.audit ?? []);
    } catch (e: any) {
      toast({ title: "Erro ao carregar Safe Mode", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function update(partial: Partial<SafeConfig>) {
    if (!config) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-safe-mode-admin", {
        method: "POST" as any,
        body: { ...partial, reason: reason || null },
      });
      if (error) throw error;
      setConfig(data?.config ?? null);
      toast({ title: "Configuração atualizada" });
      setReason("");
      load();
    } catch (e: any) {
      toast({ title: "Falha ao salvar", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex items-center gap-2 p-6"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>;
  if (!config) return <div className="p-6 text-muted-foreground">Sem configuração disponível.</div>;

  return (
    <div className="space-y-4">
      {/* Health Score */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Health Score</CardTitle>
          <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
          {health ? (
            <div className="flex items-center gap-4">
              <div className={`h-16 w-16 rounded-full ${HEALTH_COLOR[health.health_label] ?? "bg-muted"} text-white flex items-center justify-center text-xl font-bold`}>
                {health.health_score}
              </div>
              <div className="text-sm">
                <div className="font-medium uppercase">{health.health_label}</div>
                <div className="text-muted-foreground">Enviados 24h: {health.sent_24h} · Bloqueios: {health.blocked_24h} · Falhas: {health.failed_24h}</div>
                <div className="text-muted-foreground">Templates ruins: {health.bad_templates} · Opt-outs 24h: {health.optouts_24h}</div>
              </div>
            </div>
          ) : <div className="text-muted-foreground">Sem dados de saúde.</div>}
        </CardContent>
      </Card>

      {/* Toggles principais */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Modos de operação</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <ToggleRow label="Safe Mode" desc="Aplica limites globais e por contato." checked={config.safe_mode} onChange={(v) => update({ safe_mode: v })} disabled={saving} />
          <ToggleRow label="Modo Manutenção" desc="Bloqueia automáticos (libera humano + AUTHENTICATION)." checked={config.maintenance_mode} onChange={(v) => update({ maintenance_mode: v })} disabled={saving} />
          <ToggleRow label="Dry Run" desc="Simula envios sem chamar a Graph API." checked={config.dry_run} onChange={(v) => update({ dry_run: v })} disabled={saving} />
          <ToggleRow label="Override manual" desc="Ignora cap do estágio Go-Live." checked={config.manual_override} onChange={(v) => update({ manual_override: v })} disabled={saving} />
        </CardContent>
      </Card>

      {/* Circuit Breaker */}
      <Card>
        <CardHeader><CardTitle>Circuit Breaker</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {config.circuit_breaker_open ? (
            <>
              <Badge variant="destructive">ABERTO</Badge>
              <div className="text-sm text-muted-foreground">Motivo: {config.circuit_reason ?? "—"}</div>
              <Button variant="outline" disabled={saving} onClick={() => update({ circuit_breaker_open: false })}>Resetar manualmente</Button>
            </>
          ) : <Badge variant="outline">Fechado</Badge>}
        </CardContent>
      </Card>

      {/* Limites */}
      <Card>
        <CardHeader><CardTitle>Limites configuráveis</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <NumberField label="Máx. por hora" value={config.max_per_hour} onSave={(v) => update({ max_per_hour: v })} disabled={saving} />
          <NumberField label="Máx. por dia" value={config.max_per_day} onSave={(v) => update({ max_per_day: v })} disabled={saving} />
          <NumberField label="Máx. por contato (30d)" value={config.max_per_contact_30d} onSave={(v) => update({ max_per_contact_30d: v })} disabled={saving} />
        </CardContent>
      </Card>

      {/* Go Live */}
      <Card>
        <CardHeader><CardTitle>Estágio Go-Live</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {[0,1,2,3,4].map((stage) => (
            <Button key={stage} variant={config.go_live_stage === stage ? "default" : "outline"} size="sm"
              disabled={saving} onClick={() => update({ go_live_stage: stage })}>
              {STAGE_LABEL[stage]}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Motivo */}
      <Card>
        <CardHeader><CardTitle>Motivo da próxima alteração (auditoria)</CardTitle></CardHeader>
        <CardContent>
          <Input placeholder="Ex.: ativando manutenção para fim de semana" value={reason} onChange={(e) => setReason(e.target.value)} />
        </CardContent>
      </Card>

      {/* Auditoria */}
      <Card>
        <CardHeader><CardTitle>Últimas alterações</CardTitle></CardHeader>
        <CardContent className="overflow-auto max-h-80">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th>Quando</th><th>Campo</th><th>Antes</th><th>Depois</th><th>Motivo</th></tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="py-1 pr-3 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="py-1 pr-3 font-mono">{a.field}</td>
                  <td className="py-1 pr-3 text-muted-foreground">{JSON.stringify(a.old_value)}</td>
                  <td className="py-1 pr-3">{JSON.stringify(a.new_value)}</td>
                  <td className="py-1 pr-3 text-muted-foreground">{a.reason ?? "—"}</td>
                </tr>
              ))}
              {audit.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Sem registros.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange, disabled }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 p-3 border rounded-md">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function NumberField({ label, value, onSave, disabled }: { label: string; value: number; onSave: (v: number) => void; disabled?: boolean }) {
  const [v, setV] = useState(String(value));
  useEffect(() => { setV(String(value)); }, [value]);
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input type="number" min={0} value={v} onChange={(e) => setV(e.target.value)} disabled={disabled} />
        <Button size="sm" disabled={disabled || Number(v) === value} onClick={() => onSave(Number(v) || 0)}>OK</Button>
      </div>
    </div>
  );
}
