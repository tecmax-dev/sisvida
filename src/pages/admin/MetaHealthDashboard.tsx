import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, ShieldCheck, AlertTriangle, Activity } from "lucide-react";
import { computeReputation, REPUTATION_COLORS, type ContactReputation } from "@/lib/whatsapp/contactReputation";

interface TemplateRow {
  name: string;
  language: string;
  category: string | null;
  status: string | null;
  in_catalog: boolean;
  last_used_at: string | null;
  lifecycle: "ACTIVE" | "DEPRECATED" | "ARCHIVED";
}

export default function MetaHealthDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState<{ summary: any; templates: TemplateRow[] } | null>(null);
  const [sendStats, setSendStats] = useState<any>(null);
  const [reputation, setReputation] = useState<Record<ContactReputation, number>>({
    EXCELLENT: 0, GOOD: 0, NORMAL: 0, LOW: 0, DO_NOT_DISTURB: 0,
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [metaStatus, setMetaStatus] = useState<{
    byStatus: Record<string, number>;
    rejected: Array<{ name: string; language: string; rejection_reason: string | null; updated_at: string | null }>;
    missing: string[];
  }>({ byStatus: {}, rejected: [], missing: [] });

  async function loadAll() {
    setRefreshing(true);
    try {
      const [reportRes, sentByCat, blocks, optOutsCount, consentsCount, prefs, logs, metaRows] = await Promise.all([
        supabase.functions.invoke("meta-templates-report", { body: {} }),
        supabase.from("whatsapp_template_logs")
          .select("category, status, sent_at")
          .gte("sent_at", new Date(Date.now() - 30 * 86400 * 1000).toISOString())
          .limit(5000),
        supabase.from("whatsapp_template_logs")
          .select("reason")
          .like("status", "blocked_%")
          .gte("sent_at", new Date(Date.now() - 30 * 86400 * 1000).toISOString())
          .limit(2000),
        supabase.from("whatsapp_opt_outs").select("id", { count: "exact", head: true }),
        supabase.from("marketing_consents").select("id", { count: "exact", head: true }),
        supabase.from("contact_preferences")
          .select("interaction_score, last_inbound_at, last_interaction_at, last_template_sent_at, whatsapp_optout, whatsapp_optout_at")
          .limit(5000),
        supabase.from("whatsapp_audit_logs")
          .select("id, content, session_state, message_type, metadata, created_at")
          .eq("message_type", "compliance_audit")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("whatsapp_meta_templates")
          .select("name, language, status, rejection_reason, updated_at")
          .limit(500),
      ]);

      if (reportRes.data) setReport(reportRes.data as any);

      // Envios por categoria + por dia
      const byCat: Record<string, number> = {};
      const sentByDay: Record<string, number> = {};
      for (const r of (sentByCat.data ?? []) as any[]) {
        if (r.status === "sent") {
          const cat = r.category ?? "UNKNOWN";
          byCat[cat] = (byCat[cat] ?? 0) + 1;
          const day = (r.sent_at ?? "").slice(0, 10);
          if (day) sentByDay[day] = (sentByDay[day] ?? 0) + 1;
        }
      }
      const byReason: Record<string, number> = {};
      for (const r of (blocks.data ?? []) as any[]) {
        const k = r.reason ?? "unknown";
        byReason[k] = (byReason[k] ?? 0) + 1;
      }

      setSendStats({
        byCategory: byCat,
        byDay: sentByDay,
        blocks: byReason,
        optOuts: optOutsCount.count ?? 0,
        consents: consentsCount.count ?? 0,
      });

      const repCounts: Record<ContactReputation, number> = {
        EXCELLENT: 0, GOOD: 0, NORMAL: 0, LOW: 0, DO_NOT_DISTURB: 0,
      };
      for (const p of (prefs.data ?? []) as any[]) {
        const r = computeReputation({
          score: p.interaction_score,
          lastInteractionAt: p.last_inbound_at,
          lastReplyAt: p.last_interaction_at,
          optOutAt: p.whatsapp_optout ? p.whatsapp_optout_at : null,
        });
        repCounts[r]++;
      }
      setReputation(repCounts);
      setAuditLogs((logs.data ?? []) as any[]);

      // Status local da Meta (whatsapp_meta_templates)
      const byStatus: Record<string, number> = {};
      const rejected: Array<any> = [];
      const localNames = new Set<string>();
      for (const r of (metaRows.data ?? []) as any[]) {
        const st = (r.status || "UNKNOWN").toUpperCase();
        byStatus[st] = (byStatus[st] ?? 0) + 1;
        localNames.add(r.name);
        if (st === "REJECTED") rejected.push(r);
      }
      const missing: string[] = [];
      for (const t of (reportRes.data?.templates ?? []) as any[]) {
        if (t.in_catalog && !localNames.has(t.name)) missing.push(t.name);
      }
      setMetaStatus({ byStatus, rejected, missing });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function runAudit() {
    setRefreshing(true);
    await supabase.functions.invoke("meta-compliance-audit", { body: {} });
    await loadAll();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const s = report?.summary ?? {};

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="text-primary" /> Meta Health Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada do Compliance Engine. Dados 100% locais — não depende da Graph API.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAll} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button onClick={runAudit} disabled={refreshing}>
            <Activity className="h-4 w-4 mr-2" /> Rodar auditoria
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <SummaryCard label="Total templates" value={s.total ?? 0} />
        <SummaryCard label="Ativos" value={s.active ?? 0} tone="ok" />
        <SummaryCard label="Depreciados" value={s.deprecated ?? 0} tone="warn" />
        <SummaryCard label="Arquivados" value={s.archived ?? 0} />
        <SummaryCard label="Fora do catálogo" value={s.out_of_catalog ?? 0} tone={s.out_of_catalog ? "danger" : "ok"} />
        <SummaryCard label="Duplicados" value={s.duplicates ?? 0} tone={s.duplicates ? "warn" : "ok"} />
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="meta-status">Status Meta</TabsTrigger>
          <TabsTrigger value="sends">Envios</TabsTrigger>
          <TabsTrigger value="reputation">Reputação</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-3">
          <Card>
            <CardHeader><CardTitle>Por categoria</CardTitle></CardHeader>
            <CardContent className="flex gap-4 flex-wrap">
              {Object.entries(s.by_category ?? {}).map(([k, v]) => (
                <Badge key={k} variant="outline">{k}: {String(v)}</Badge>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Templates ({report?.templates.length})</CardTitle></CardHeader>
            <CardContent className="overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th>Nome</th><th>Cat.</th><th>Status</th><th>Catálogo</th><th>Ciclo</th><th>Último uso</th></tr>
                </thead>
                <tbody>
                  {report?.templates.map((t) => (
                    <tr key={`${t.name}-${t.language}`} className="border-t">
                      <td className="py-1">{t.name}</td>
                      <td>{t.category}</td>
                      <td>{t.status}</td>
                      <td>{t.in_catalog ? "✓" : <Badge variant="destructive">fora</Badge>}</td>
                      <td>
                        <Badge variant={t.lifecycle === "ACTIVE" ? "default" : t.lifecycle === "DEPRECATED" ? "secondary" : "outline"}>
                          {t.lifecycle}
                        </Badge>
                      </td>
                      <td>{t.last_used_at ? new Date(t.last_used_at).toLocaleDateString("pt-BR") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meta-status" className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {["APPROVED","PENDING","REJECTED","PAUSED","DISABLED","FLAGGED"].map((st) => (
              <SummaryCard
                key={st}
                label={st}
                value={metaStatus.byStatus[st] ?? 0}
                tone={st === "APPROVED" ? "ok" : st === "REJECTED" || st === "DISABLED" ? "danger" : st === "PENDING" || st === "PAUSED" || st === "FLAGGED" ? "warn" : undefined}
              />
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle>Templates sem status local ({metaStatus.missing.length})</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {metaStatus.missing.length === 0 ? (
                <span className="text-muted-foreground">Todos os templates canônicos estão sincronizados.</span>
              ) : (
                <ul className="list-disc pl-5">
                  {metaStatus.missing.map((n) => <li key={n} className="font-mono">{n}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Rejeições ({metaStatus.rejected.length})</CardTitle></CardHeader>
            <CardContent className="overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th>Nome</th><th>Idioma</th><th>Motivo</th><th>Atualizado</th></tr>
                </thead>
                <tbody>
                  {metaStatus.rejected.map((r) => (
                    <tr key={`${r.name}-${r.language}`} className="border-t">
                      <td className="font-mono">{r.name}</td>
                      <td>{r.language}</td>
                      <td className="text-red-600">{r.rejection_reason ?? "—"}</td>
                      <td>{r.updated_at ? new Date(r.updated_at).toLocaleString("pt-BR") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sends" className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <Card>
              <CardHeader><CardTitle>Envios por categoria (30d)</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {Object.entries(sendStats?.byCategory ?? {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between"><span>{k}</span><span className="font-mono">{String(v)}</span></div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Bloqueios preventivos</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {Object.entries(sendStats?.blocks ?? {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm"><span>{k}</span><span className="font-mono">{String(v)}</span></div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Consentimento</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between"><span>Opt-in (marketing)</span><span className="font-mono">{sendStats?.consents ?? 0}</span></div>
                <div className="flex justify-between"><span>Opt-out (PARAR)</span><span className="font-mono text-red-600">{sendStats?.optOuts ?? 0}</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reputation">
          <Card>
            <CardHeader><CardTitle>Distribuição de reputação</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(Object.keys(reputation) as ContactReputation[]).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${REPUTATION_COLORS[k]}`} />
                  <span className="w-40">{k}</span>
                  <span className="font-mono">{reputation[k]}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Logs recentes (50)
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th>Data</th><th>Ação</th><th>Severidade</th></tr>
                </thead>
                <tbody>
                  {auditLogs.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td>{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                      <td className="font-mono text-xs">{l.content}</td>
                      <td>
                        <Badge variant={l.session_state === "high" ? "destructive" : l.session_state === "medium" ? "secondary" : "outline"}>
                          {l.session_state}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "danger" }) {
  const color = tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-emerald-600" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}