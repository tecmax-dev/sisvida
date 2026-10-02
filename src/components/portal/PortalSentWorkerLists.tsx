import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronDown, Eye, FileText, Loader2, RefreshCw } from "lucide-react";
import { WorkerListDocumentModal } from "./WorkerListDocumentModal";

interface SentList {
  id: string; employer_id: string; status: string; reason: string | null; file_name: string | null;
  created_at: string; origin: string; competence_month: number | null; competence_year: number | null;
  quantidade: number | null; type_name: string | null; employer_name: string | null;
}

const ORIGIN: Record<string, string> = { employer: "Empresa", accounting_office: "Contador", staff: "Sindicato" };

const fileLabel = (n: string | null) =>
  !n || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(n) ? "Lista de trabalhadores" : n;

export function PortalSentWorkerLists({ portalType, portalId, showEmployer }: {
  portalType: "employer" | "accounting_office"; portalId: string; showEmployer?: boolean;
}) {
  const [lists, setLists] = useState<SentList[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke("validate-worker-list", {
      body: { action: "list_sent", portal_type: portalType, portal_id: portalId },
    });
    setLists((data as any)?.lists || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [portalType, portalId]);

  // Só validadas; uma linha por empresa+tipo+competência (a mais recente), demais recolhidas
  const rows = useMemo(() => {
    const map = new Map<string, SentList[]>();
    for (const l of lists) {
      if (l.status !== "valid") continue;
      const k = `${l.employer_id}|${l.type_name}|${l.competence_year}-${l.competence_month}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(l);
    }
    return Array.from(map.entries())
      .map(([key, items]) => ({ key, latest: items[0], older: items.slice(1) }))
      .sort((a, b) =>
        (b.latest.competence_year ?? 0) - (a.latest.competence_year ?? 0) ||
        (b.latest.competence_month ?? 0) - (a.latest.competence_month ?? 0) ||
        (a.latest.type_name || "").localeCompare(b.latest.type_name || ""));
  }, [lists]);

  const comp = (l: SentList) =>
    l.competence_month && l.competence_year ? `${String(l.competence_month).padStart(2, "0")}/${l.competence_year}` : "—";
  const date = (s: string) => new Date(s).toLocaleDateString("pt-BR");

  const Line = ({ l, sub }: { l: SentList; sub?: boolean }) => (
    <tr className={sub ? "bg-muted/30 text-muted-foreground" : "border-t"}>
      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{sub ? "" : comp(l)}</td>
      <td className="px-3 py-2 text-sm">{sub ? "" : l.type_name || "—"}</td>
      {showEmployer && <td className="px-3 py-2 text-sm truncate max-w-[180px]">{sub ? "" : l.employer_name}</td>}
      <td className="px-3 py-2 text-xs max-w-[260px]">
        <span className="flex items-center gap-1.5 truncate"><FileText className="h-3.5 w-3.5 shrink-0" />{fileLabel(l.file_name)}</span>
      </td>
      <td className="px-3 py-2 text-xs whitespace-nowrap">{date(l.created_at)} · {ORIGIN[l.origin] || l.origin}</td>
      <td className="px-3 py-2 text-xs text-center">{l.quantidade ?? "—"}</td>
      <td className="px-3 py-2 text-right">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setViewing(l.id)}>
          <Eye className="h-3.5 w-3.5 mr-1" /> Ver
        </Button>
      </td>
    </tr>
  );

  return (
    <section className="mt-8 rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
        <div>
          <h2 className="text-base font-semibold text-foreground">Listas de trabalhadores enviadas</h2>
          <p className="text-xs text-muted-foreground">Listas validadas por competência e tipo de contribuição.</p>
        </div>
        <Button variant="outline" size="sm" className="h-8" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {loading && lists.length === 0 ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma lista validada até o momento.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground bg-muted/40">
              <tr>
                <th className="px-3 py-2 font-medium">Competência</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                {showEmployer && <th className="px-3 py-2 font-medium">Empresa</th>}
                <th className="px-3 py-2 font-medium">Arquivo</th>
                <th className="px-3 py-2 font-medium">Envio</th>
                <th className="px-3 py-2 font-medium text-center">Trab.</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <>
                  <Line key={r.key} l={r.latest} />
                  {r.older.length > 0 && (
                    <tr key={r.key + "-t"}>
                      <td colSpan={showEmployer ? 7 : 6} className="px-3 pb-2">
                        <button className="flex items-center gap-1 text-xs text-primary hover:underline"
                          onClick={() => setOpen((o) => ({ ...o, [r.key]: !o[r.key] }))}>
                          <ChevronDown className={`h-3 w-3 transition-transform ${open[r.key] ? "rotate-180" : ""}`} />
                          {open[r.key] ? "Ocultar" : "Ver"} {r.older.length} envio(s) anterior(es)
                        </button>
                      </td>
                    </tr>
                  )}
                  {open[r.key] && r.older.map((o) => <Line key={o.id} l={o} sub />)}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <WorkerListDocumentModal validationId={viewing} portalType={portalType} portalId={portalId} onClose={() => setViewing(null)} />
    </section>
  );
}
