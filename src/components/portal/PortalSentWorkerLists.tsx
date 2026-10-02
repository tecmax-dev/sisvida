import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, FileText, Loader2, RefreshCw } from "lucide-react";
import { WorkerListDocumentModal } from "./WorkerListDocumentModal";

interface SentList {
  id: string; employer_id: string; status: string; reason: string | null; file_name: string | null;
  created_at: string; origin: string; competence_month: number | null; competence_year: number | null;
  quantidade: number | null; type_name: string | null; employer_name: string | null;
}

const ORIGIN: Record<string, string> = { employer: "Portal da Empresa", accounting_office: "Portal do Contador", staff: "Equipe do Sindicato" };

export function PortalSentWorkerLists({ portalType, portalId, showEmployer }: {
  portalType: "employer" | "accounting_office"; portalId: string; showEmployer?: boolean;
}) {
  const [lists, setLists] = useState<SentList[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke("validate-worker-list", {
      body: { action: "list_sent", portal_type: portalType, portal_id: portalId },
    });
    setLists((data as any)?.lists || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [portalType, portalId]);

  // Agrupa por tipo de contribuição → competência
  const groups = useMemo(() => {
    const byType = new Map<string, Map<string, SentList[]>>();
    for (const l of lists) {
      const t = l.type_name || "Sem tipo informado";
      const c = l.competence_month && l.competence_year
        ? `${l.competence_year}-${String(l.competence_month).padStart(2, "0")}` : "sem";
      if (!byType.has(t)) byType.set(t, new Map());
      const m = byType.get(t)!;
      if (!m.has(c)) m.set(c, []);
      m.get(c)!.push(l);
    }
    return Array.from(byType.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([t, m]) => ({
      type: t,
      comps: Array.from(m.entries()).sort(([a], [b]) => (a === "sem" ? 1 : b === "sem" ? -1 : b.localeCompare(a))),
    }));
  }, [lists]);

  const fmtComp = (k: string) => (k === "sem" ? "Sem competência" : `${k.slice(5)}/${k.slice(0, 4)}`);

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Listas de trabalhadores enviadas</h2>
          <p className="text-sm text-muted-foreground">Separadas por tipo de contribuição e competência.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {loading && lists.length === 0 ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma lista enviada até o momento.</div>
      ) : (
        groups.map((g) => (
          <Card key={g.type} className="shadow-none">
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold text-foreground">{g.type}</h3>
              {g.comps.map(([comp, rows]) => (
                <div key={comp} className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Competência {fmtComp(comp)}</p>
                  {rows.map((r) => (
                    <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border p-3">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{r.file_name || "Lista de trabalhadores"}</p>
                        <p className="text-xs text-muted-foreground">
                          {showEmployer && r.employer_name ? `${r.employer_name} • ` : ""}
                          {new Date(r.created_at).toLocaleString("pt-BR")} • {ORIGIN[r.origin] || r.origin}
                          {r.quantidade ? ` • ${r.quantidade} trabalhador(es)` : ""}
                        </p>
                        {r.status !== "valid" && r.reason && <p className="text-xs text-destructive mt-1">{r.reason}</p>}
                      </div>
                      <Badge variant={r.status === "valid" ? "default" : "destructive"}>{r.status === "valid" ? "Validada" : "Não validada"}</Badge>
                      <Button size="sm" variant="outline" onClick={() => setViewing(r.id)}><Eye className="h-4 w-4 mr-1" /> Ver</Button>
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
      <WorkerListDocumentModal validationId={viewing} portalType={portalType} portalId={portalId} onClose={() => setViewing(null)} />
    </div>
  );
}
