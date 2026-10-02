import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Plus, X, Save, Users, Search } from "lucide-react";
import { toast } from "sonner";

type Name = { nome: string; cpf: string | null };
interface Contrib { id: string; competence_month: number; competence_year: number; status: string; type_name: string | null }
interface Item { worker_id: string; contribution_id: string; competence_month: number; competence_year: number; type_name: string | null }

const key = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
const comp = (m: number, y: number) => `${String(m).padStart(2, "0")}/${y}`;
const STATUS: Record<string, string> = { awaiting_value: "Aguardando valor", pending: "A vencer", overdue: "Vencida", paid: "Paga" };

export function WorkerRosterEditor({ employerId, portalType, portalId, onSaved }: {
  employerId: string; portalType: "employer" | "accounting_office" | "staff"; portalId?: string; onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<{ id: string; name: string; cpf: string | null }[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [contribs, setContribs] = useState<Contrib[]>([]);
  const [contribId, setContribId] = useState("");
  const [names, setNames] = useState<Name[]>([]);
  const [newName, setNewName] = useState("");
  const [filter, setFilter] = useState("");
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);

  const call = (action: string, extra: Record<string, unknown> = {}) =>
    supabase.functions.invoke("validate-worker-list", {
      body: { action, employer_id: employerId, portal_type: portalType, portal_id: portalId, ...extra },
    });

  const load = async () => {
    setLoading(true);
    const { data } = await call("roster_get");
    const d: any = data || {};
    if (d.error) toast.error(d.error);
    setWorkers(d.workers || []); setItems(d.items || []); setContribs(d.contributions || []);
    setLoading(false);
  };
  useEffect(() => { setContribId(""); setNames([]); load(); /* eslint-disable-next-line */ }, [employerId]);

  // Ao escolher competência: usa a lista dela, ou a da competência anterior mais recente
  useEffect(() => {
    if (!contribId) { setNames([]); return; }
    const byId = new Map(workers.map((w) => [w.id, w]));
    const toNames = (cid: string) => items.filter((i) => i.contribution_id === cid)
      .map((i) => byId.get(i.worker_id)).filter(Boolean).map((w) => ({ nome: w!.name, cpf: w!.cpf }));
    const own = toNames(contribId);
    if (own.length) { setNames(own); return; }
    const c = contribs.find((x) => x.id === contribId);
    const idx = c ? c.competence_year * 12 + c.competence_month : 0;
    const prev = [...new Set(items.filter((i) => i.competence_year * 12 + i.competence_month < idx)
      .sort((a, b) => (b.competence_year * 12 + b.competence_month) - (a.competence_year * 12 + a.competence_month))
      .map((i) => i.contribution_id))][0];
    setNames(prev ? toNames(prev) : workers.map((w) => ({ nome: w.name, cpf: w.cpf })));
  }, [contribId, items, workers, contribs]);

  const merge = (incoming: Name[]) => {
    setNames((cur) => {
      const seen = new Set(cur.map((n) => key(n.nome)));
      const add = incoming.filter((n) => { const k = key(n.nome); if (k.length < 3 || seen.has(k)) return false; seen.add(k); return true; });
      if (add.length === 0) toast.info("Nenhum nome novo — os nomes já estavam na lista.");
      else toast.success(`${add.length} nome(s) incluído(s).`);
      return [...cur, ...add].sort((a, b) => a.nome.localeCompare(b.nome));
    });
  };

  const importLists = async () => {
    setImporting(true);
    const { data } = await call("roster_import");
    setImporting(false);
    const d: any = data || {};
    if (d.error) return toast.error(d.error);
    if (!d.names?.length) return toast.info("Nenhum nome encontrado nas listas enviadas.");
    merge(d.names);
  };

  const addName = () => { if (newName.trim()) { merge([{ nome: newName.trim(), cpf: null }]); setNewName(""); } };

  const save = async () => {
    if (!contribId) return toast.error("Escolha a competência.");
    if (!names.length) return toast.error("Inclua pelo menos 1 nome.");
    setSaving(true);
    const { data } = await call("roster_save", { contribution_id: contribId, names });
    setSaving(false);
    const d: any = data || {};
    if (d.error) return toast.error(d.error);
    toast.success(`Lista da competência salva com ${d.total} trabalhador(es).`);
    await load(); onSaved?.();
  };

  const shown = useMemo(() => names.filter((n) => !filter || key(n.nome).includes(key(filter))), [names, filter]);
  const prevKeys = useMemo(() => new Set(workers.map((w) => key(w.name))), [workers]);

  return (
    <section className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2"><Users className="h-4 w-4" /> Trabalhadores da empresa</h2>
          <p className="text-xs text-muted-foreground">Monte a lista de cada competência sem repetir nomes. {workers.length} nome(s) cadastrado(s).</p>
        </div>
        <Button variant="outline" size="sm" onClick={importLists} disabled={importing || loading}>
          {importing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
          Importar das listas enviadas
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="p-4 space-y-3">
          <select value={contribId} onChange={(e) => setContribId(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">{contribs.length ? "Escolha a competência" : "Nenhuma competência disponível"}</option>
            {contribs.map((c) => (
              <option key={c.id} value={c.id}>
                {comp(c.competence_month, c.competence_year)} — {c.type_name || "Contribuição"} ({STATUS[c.status] || c.status})
                {items.some((i) => i.contribution_id === c.id) ? " • lista salva" : ""}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <Input placeholder="Incluir nome" value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addName()} />
            <Button type="button" variant="outline" onClick={addName}><Plus className="h-4 w-4" /></Button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-3 text-muted-foreground" />
              <Input className="pl-8 h-9" placeholder="Buscar na lista" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
            <Badge variant="secondary">{names.length} nome(s)</Badge>
          </div>

          <div className="max-h-80 overflow-y-auto rounded-md border divide-y">
            {shown.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum nome. Importe das listas enviadas ou inclua manualmente.</p>
            ) : shown.map((n) => (
              <div key={key(n.nome)} className="flex items-center justify-between px-3 py-1.5 text-sm">
                <span className="truncate">
                  {n.nome}
                  {!prevKeys.has(key(n.nome)) && <Badge variant="outline" className="ml-2 text-[10px]">novo</Badge>}
                </span>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                  onClick={() => setNames((cur) => cur.filter((x) => key(x.nome) !== key(n.nome)))} aria-label="Remover nome">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Button className="w-full" onClick={save} disabled={saving || !contribId || !names.length}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Confirmar lista da competência
          </Button>
        </div>
      )}
    </section>
  );
}
