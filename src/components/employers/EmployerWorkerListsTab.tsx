import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FileText, Loader2, RefreshCw, Eye, Download, CalendarDays, CheckCircle2, XCircle, Users, FolderOpen, Search, ChevronDown, ChevronRight, Upload, RotateCcw, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StaffWorkerListUploadDialog } from "./StaffWorkerListUploadDialog";
import { WorkerRosterEditor } from "@/components/portal/WorkerRosterEditor";
import { usePermissions } from "@/hooks/usePermissions";

interface Row {
  id: string;
  file_path: string;
  file_name: string | null;
  status: string;
  competence_month: number | null;
  competence_year: number | null;
  quantidade: number | null;
  reason: string | null;
  portal_type: string;
  created_at: string;
  type_name: string | null;
}

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const NO_COMP = "sem-competencia";

export default function EmployerWorkerListsTab({ employerId }: { employerId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "valid" | "invalid">("all");
  const [year, setYear] = useState<string>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [viewer, setViewer] = useState<{ url: string; name: string; isPdf: boolean } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("contribution_worker_list_validations")
      .select("id, file_path, file_name, status, competence_month, competence_year, reason, portal_type, created_at, ai_result, contribution_type:contribution_types(name)")
      .eq("employer_id", employerId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Não foi possível carregar as listas.");
    setRows(
      (data || []).map((r: any) => ({
        ...r,
        quantidade: r.ai_result?.quantidade_trabalhadores ?? null,
        type_name: r.contribution_type?.name ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, [employerId]);

  const { isAdmin: isManager } = usePermissions();
  const [acting, setActing] = useState<string | null>(null);
  const [actionDlg, setActionDlg] = useState<{ row: Row; action: "staff_reprocess" | "staff_approve" } | null>(null);
  const [contribOpts, setContribOpts] = useState<{ id: string; label: string }[]>([]);
  const [dlgContrib, setDlgContrib] = useState("");
  const [dlgNote, setDlgNote] = useState("");

  const openAction = async (r: Row, action: "staff_reprocess" | "staff_approve") => {
    setActionDlg({ row: r, action }); setDlgContrib(""); setDlgNote("");
    const { data } = await (supabase as any)
      .from("employer_contributions")
      .select("id, competence_month, competence_year, status, contribution_type:contribution_types(name)")
      .eq("employer_id", employerId)
      .in("status", ["awaiting_value", "pending", "overdue", "paid"])
      .order("competence_year", { ascending: false }).order("competence_month", { ascending: false })
      .limit(60);
    setContribOpts((data || []).map((c: any) => ({
      id: c.id,
      label: `${String(c.competence_month).padStart(2, "0")}/${c.competence_year} — ${c.contribution_type?.name || "Contribuição"}`,
    })));
  };

  const runAction = async () => {
    if (!actionDlg) return;
    const { row: r, action } = actionDlg;
    setActing(`${action}:${r.id}`);
    const { data, error } = await supabase.functions.invoke("validate-worker-list", {
      body: { action, validation_id: r.id, note: dlgNote, contribution_id: dlgContrib || undefined },
    });
    setActing(null);
    if (error || data?.error) { toast.error(data?.error || "Não foi possível concluir a ação."); return; }
    setActionDlg(null);
    if (action === "staff_approve") toast.success("Lista aprovada manualmente.");
    else if (data?.result?.valido) toast.success("Lista reprocessada e validada.");
    else toast.warning(`Lista reprocessada e continua reprovada: ${data?.result?.motivo || ""}`);
    load();
  };

  const importNames = async (r: Row) => {
    setActing(`import:${r.id}`);
    const { data, error } = await supabase.functions.invoke("validate-worker-list", { body: { action: "staff_import_names", validation_id: r.id } });
    setActing(null);
    if (error || data?.error) { toast.error(data?.error || "Não foi possível importar os nomes."); return; }
    toast.success(`${data.added} nome(s) importado(s)${data.skipped ? ` • ${data.skipped} já cadastrado(s)` : ""}.`);
    setRosterKey((k) => k + 1);
  };
  const [rosterKey, setRosterKey] = useState(0);

  const signedUrl = async (r: Row) => {
    setOpening(r.id);
    const { data, error } = await supabase.storage.from("worker-lists").createSignedUrl(r.file_path, 3600);
    setOpening(null);
    if (error || !data?.signedUrl) { toast.error("Não foi possível abrir o arquivo."); return null; }
    return data.signedUrl;
  };

  const view = async (r: Row) => {
    const url = await signedUrl(r);
    if (url) setViewer({ url, name: r.file_name || "Lista de trabalhadores", isPdf: /\.pdf$/i.test(r.file_path) });
  };
  const download = async (r: Row) => {
    const url = await signedUrl(r);
    if (url) window.open(url, "_blank", "noopener");
  };

  const years = useMemo(
    () => Array.from(new Set(rows.map((r) => r.competence_year).filter(Boolean) as number[])).sort((a, b) => b - a),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === "valid" && r.status !== "valid") return false;
      if (status === "invalid" && r.status === "valid") return false;
      if (year !== "all" && String(r.competence_year) !== year) return false;
      if (q && !`${r.file_name ?? ""} ${r.type_name ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, status, year]);

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      const key = r.competence_month && r.competence_year
        ? `${r.competence_year}-${String(r.competence_month).padStart(2, "0")}`
        : NO_COMP;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a === NO_COMP ? 1 : b === NO_COMP ? -1 : b.localeCompare(a)));
  }, [filtered]);

  const stats = useMemo(() => {
    const valid = rows.filter((r) => r.status === "valid");
    const comps = new Set(valid.filter((r) => r.competence_month).map((r) => `${r.competence_year}-${r.competence_month}`));
    const last = valid.find((r) => r.competence_month);
    return {
      total: rows.length,
      valid: valid.length,
      invalid: rows.length - valid.length,
      comps: comps.size,
      lastWorkers: last?.quantidade ?? null,
    };
  }, [rows]);

  const groupLabel = (key: string) => {
    if (key === NO_COMP) return "Competência não identificada";
    const [y, m] = key.split("-");
    return `${MONTHS[Number(m) - 1]} de ${y}`;
  };

  const kpis = [
    { label: "Listas enviadas", value: stats.total, icon: FolderOpen, cls: "text-primary bg-primary/10" },
    { label: "Validadas", value: stats.valid, icon: CheckCircle2, cls: "text-primary bg-primary/10" },
    { label: "Reprovadas", value: stats.invalid, icon: XCircle, cls: "text-destructive bg-destructive/10" },
    { label: "Competências cobertas", value: stats.comps, icon: CalendarDays, cls: "text-foreground bg-muted" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Listas de trabalhadores por competência</h2>
          <p className="text-sm text-muted-foreground">
            Relações de funcionários enviadas pela empresa ou contabilidade para gerar as contribuições.
            {stats.lastWorkers ? ` Última lista validada: ${stats.lastWorkers} trabalhador(es).` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> Enviar lista
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} /> Atualizar
          </Button>
        </div>
        <StaffWorkerListUploadDialog employerId={employerId} open={uploadOpen} onOpenChange={setUploadOpen} onUploaded={load} />
      </div>

      <WorkerRosterEditor employerId={employerId} portalType="staff" onSaved={load} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="shadow-none">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", k.cls)}>
                <k.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{k.label}</p>
                <p className="text-xl font-semibold text-foreground">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por arquivo ou tipo de contribuição..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select aria-label="Ano" value={year} onChange={(e) => setYear(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">Todos os anos</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex rounded-md border border-input p-0.5 bg-muted/40">
          {([["all", "Todas"], ["valid", "Validadas"], ["invalid", "Reprovadas"]] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setStatus(v)}
              className={cn("px-3 h-9 text-sm rounded transition-colors", status === v ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-foreground">{rows.length === 0 ? "Nenhuma lista enviada até o momento" : "Nenhuma lista encontrada com esses filtros"}</p>
          <p className="text-xs text-muted-foreground mt-1">As listas aparecem aqui assim que a empresa ou a contabilidade as enviam pelo portal.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(([key, items]) => {
            const isCollapsed = collapsed[key];
            const validCount = items.filter((i) => i.status === "valid").length;
            const workers = items.find((i) => i.status === "valid" && i.quantidade)?.quantidade;
            return (
              <div key={key} className="rounded-lg border bg-card overflow-hidden">
                <button type="button" onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
                  className="w-full flex flex-wrap items-center gap-2 px-4 py-3 bg-muted/40 hover:bg-muted/60 text-left">
                  {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">{groupLabel(key)}</span>
                  <span className="text-xs text-muted-foreground">· {items.length} lista(s)</span>
                  <div className="ml-auto flex items-center gap-2">
                    {workers ? <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />{workers}</Badge> : null}
                    <Badge variant={validCount > 0 ? "default" : "destructive"}>{validCount > 0 ? `${validCount} validada(s)` : "Sem lista válida"}</Badge>
                  </div>
                </button>
                {!isCollapsed && (
                  <div className="divide-y">
                    {items.map((r) => (
                      <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
                        <FileText className="h-5 w-5 text-muted-foreground shrink-0 hidden sm:block" />
                        <div className="flex-1 min-w-0 text-sm">
                          <button type="button" onClick={() => view(r)} className="font-medium text-foreground hover:text-primary hover:underline truncate block max-w-full text-left">
                            {r.file_name || "Lista de trabalhadores"}
                          </button>
                          <div className="text-muted-foreground text-xs mt-0.5">
                            {r.type_name || "—"}
                            {r.quantidade ? ` • ${r.quantidade} trabalhador(es)` : ""}
                            {` • ${r.portal_type === "accounting_office" ? "Portal do Contador" : r.portal_type === "staff" ? "Equipe do Sindicato" : "Portal da Empresa"}`}
                            {` • ${new Date(r.created_at).toLocaleString("pt-BR")}`}
                          </div>
                          {r.status !== "valid" && r.reason && <div className="text-xs text-destructive mt-0.5">{r.reason}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={r.status === "valid" ? "default" : "destructive"}>{r.status === "valid" ? "Validada" : "Reprovada"}</Badge>
                          {isManager && r.status !== "valid" && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => openAction(r, "staff_reprocess")} disabled={!!acting}>
                                {acting === `staff_reprocess:${r.id}` ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />} Reprocessar
                              </Button>
                              <Button size="sm" onClick={() => openAction(r, "staff_approve")} disabled={!!acting}>
                                {acting === `staff_approve:${r.id}` ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />} Aprovar
                              </Button>
                            </>
                          )}
                          {isManager && !r.file_path.startsWith("roster/") && (
                            <Button size="sm" variant="outline" onClick={() => importNames(r)} disabled={!!acting}>
                              {acting === `import:${r.id}` ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Users className="h-4 w-4 mr-1" />} Importar nomes
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => view(r)} disabled={opening === r.id}>
                            {opening === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4 mr-1" />} Ver
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Baixar" onClick={() => download(r)} disabled={opening === r.id}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!actionDlg} onOpenChange={(o) => !o && !acting && setActionDlg(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{actionDlg?.action === "staff_approve" ? "Aprovar lista manualmente" : "Reprocessar lista"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="text-muted-foreground">
              Atual: {actionDlg?.row.type_name || "—"} • {actionDlg?.row.competence_month ? `${String(actionDlg.row.competence_month).padStart(2, "0")}/${actionDlg.row.competence_year}` : "sem competência"}
            </div>
            <div>
              <label htmlFor="wl-edit-contrib" className="font-medium">Tipo de contribuição e competência</label>
              <select id="wl-edit-contrib" value={dlgContrib} onChange={(e) => setDlgContrib(e.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Manter como está</option>
                {contribOpts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            {actionDlg?.action === "staff_approve" && (
              <div>
                <label htmlFor="wl-edit-note" className="font-medium">Motivo (opcional)</label>
                <Input id="wl-edit-note" className="mt-2" value={dlgNote} onChange={(e) => setDlgNote(e.target.value)} maxLength={300} />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActionDlg(null)} disabled={!!acting}>Cancelar</Button>
              <Button onClick={runAction} disabled={!!acting}>
                {acting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {actionDlg?.action === "staff_approve" ? "Aprovar" : "Reprocessar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewer} onOpenChange={(o) => !o && setViewer(null)}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle className="truncate pr-6">{viewer?.name}</DialogTitle></DialogHeader>
          {viewer && (viewer.isPdf ? (
            <iframe src={viewer.url} title={viewer.name} className="flex-1 w-full rounded border" />
          ) : (
            <div className="flex-1 overflow-auto flex items-start justify-center bg-muted/30 rounded">
              <img src={viewer.url} alt={viewer.name} className="max-w-full h-auto" />
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
