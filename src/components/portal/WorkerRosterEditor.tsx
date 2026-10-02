import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Download, Plus, X, Save, Users, Search } from "lucide-react";
import { toast } from "sonner";

type Name = { nome: string; cpf: string | null; active?: boolean; inactive_reason?: string | null; inactive_note?: string | null; manual?: boolean };
const REASONS = ["Férias", "Licença INSS", "Demissão", "Outros"];
interface Contrib { id: string; competence_month: number; competence_year: number; status: string; type_name: string | null }
interface Item { worker_id: string; contribution_id: string; competence_month: number; competence_year: number; type_name: string | null }

const key = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
const comp = (m: number, y: number) => `${String(m).padStart(2, "0")}/${y}`;
const STATUS: Record<string, string> = { awaiting_value: "Aguardando valor", pending: "A vencer", overdue: "Vencida", paid: "Paga" };

export function WorkerRosterEditor({ employerId, portalType, portalId, onSaved }: {
  employerId: string; portalType: "employer" | "accounting_office" | "staff"; portalId?: string; onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<{ id: string; name: string; cpf: string | null; active: boolean; inactive_reason: string | null; inactive_note: string | null }[]>([]);
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

  // Todos os nomes cadastrados entram na lista com o status salvo (nunca são excluídos)
  useEffect(() => {
    if (!contribId) { setNames([]); return; }
    setNames(workers.map((w) => ({ nome: w.name, cpf: w.cpf, active: w.active !== false, inactive_reason: w.inactive_reason, inactive_note: w.inactive_note })));
  }, [contribId, workers]);

  const patch = (nome: string, p: Partial<Name>) =>
    setNames((cur) => cur.map((x) => (key(x.nome) === key(nome) ? { ...x, ...p } : x)));

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

  const addName = () => { if (newName.trim()) { merge([{ nome: newName.trim(), cpf: null, manual: true }]); setNewName(""); } };

  const save = async () => {
    if (!contribId) return toast.error("Escolha a competência.");
    if (!names.some((n) => n.active !== false)) return toast.error("Deixe pelo menos 1 trabalhador ativo.");
    const bad = names.find((n) => n.active === false && (!n.inactive_reason || (n.inactive_reason === "Outros" && !n.inactive_note?.trim())));
    if (bad) return toast.error(`Informe o motivo da desativação de ${bad.nome}.`);
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
            <Badge variant="secondary">{names.filter((n) => n.active !== false).length} ativo(s) de {names.length}</Badge>
          </div>

          <div className="max-h-80 overflow-y-auto rounded-md border divide-y">
            {shown.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum nome. Importe das listas enviadas ou inclua manualmente.</p>
            ) : shown.map((n) => (
              <div key={key(n.nome)} className={`px-3 py-1.5 text-sm ${n.active === false ? "bg-muted/40" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate ${n.active === false ? "text-muted-foreground line-through" : ""}`}>
                    {n.nome}
                    {!prevKeys.has(key(n.nome)) && <Badge variant="outline" className="ml-2 text-[10px]">novo</Badge>}
                    {n.active === false && n.inactive_reason && <Badge variant="secondary" className="ml-2 text-[10px]">{n.inactive_reason}</Badge>}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {n.manual && !prevKeys.has(key(n.nome)) && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                        onClick={() => setNames((cur) => cur.filter((x) => key(x.nome) !== key(n.nome)))} aria-label="Remover nome digitado">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Switch checked={n.active !== false} aria-label={n.active === false ? "Ativar trabalhador" : "Desativar trabalhador"}
                      onCheckedChange={(on) => patch(n.nome, on ? { active: true, inactive_reason: null, inactive_note: null } : { active: false })} />
                  </div>
                </div>
                {n.active === false && (
                  <div className="mt-1.5 flex flex-col sm:flex-row gap-2">
                    <select value={n.inactive_reason || ""} onChange={(e) => patch(n.nome, { inactive_reason: e.target.value, inactive_note: e.target.value === "Outros" ? n.inactive_note : null })}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs sm:w-44">
                      <option value="">Motivo da desativação *</option>
                      {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {n.inactive_reason === "Outros" && (
                      <Input className="h-8 text-xs" placeholder="Informe o motivo *" maxLength={300}
                        value={n.inactive_note || ""} onChange={(e) => patch(n.nome, { inactive_note: e.target.value })} />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button className="w-full" onClick={save} disabled={saving || !contribId || !names.some((n) => n.active !== false)}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Confirmar lista da competência
          </Button>
        </div>
      )}
    </section>
  );
}
