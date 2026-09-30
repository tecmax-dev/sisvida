import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Upload, RefreshCw, Files, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Validation {
  id: string; status: string; reason: string | null; file_name: string | null; created_at: string;
  quantidade: number | null; cnpj_identificado: string | null; usable: boolean;
}
interface Item {
  id: string; employer_id: string; contribution_type_id: string | null;
  competence_month: number; competence_year: number; due_date: string;
  contribution_type?: { id: string; name: string } | null;
  validation: Validation | null;
}
interface Emp { id: string; name: string; trade_name?: string | null; cnpj: string }

type Status = "Aguardando envio" | "Arquivo recebido" | "Validando" | "Validada" | "Reprovada" | "Divergência encontrada" | "Necessita correção";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const digits = (s: string) => (s || "").replace(/\D/g, "");
const fmtCnpj = (c: string) => { const d = digits(c); return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : c; };
const comp = (i: Item) => `${String(i.competence_month).padStart(2, "0")}/${i.competence_year}`;
const toBase64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = () => rej(new Error("read")); r.readAsDataURL(f); });
const mimeOf = (f: File) => f.type || (/\.pdf$/i.test(f.name) ? "application/pdf" : /\.png$/i.test(f.name) ? "image/png" : "image/jpeg");
const isDivergence = (r?: string | null) => !!r && /(CNPJ do documento|Empresa do documento|não corresponde ao tipo)/i.test(r);

function statusOf(v: Validation | null, running?: boolean): Status {
  if (running) return "Validando";
  if (!v) return "Aguardando envio";
  if (v.status === "valid") return v.usable ? "Validada" : "Necessita correção";
  return isDivergence(v.reason) ? "Divergência encontrada" : "Reprovada";
}
const badgeVariant = (s: Status) => (s === "Validada" ? "default" : s === "Aguardando envio" || s === "Arquivo recebido" || s === "Validando" ? "secondary" : "destructive");

interface BatchRow { key: string; file: File; itemId: string; auto: boolean; state: "pronto" | "identificar" | "validando" | "ok" | "erro"; message?: string; status?: Status }

export function AccountingWorkerListsPanel({ accountingOfficeId }: { accountingOfficeId: string }) {
  const [loading, setLoading] = useState(true);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [fEmp, setFEmp] = useState(""); const [fType, setFType] = useState("all");
  const [fComp, setFComp] = useState("all"); const [fStatus, setFStatus] = useState("all");
  const [fFrom, setFFrom] = useState(""); const [fTo, setFTo] = useState("");
  const [batchOpen, setBatchOpen] = useState(false);
  const [batch, setBatch] = useState<BatchRow[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [summary, setSummary] = useState<{ total: number; ok: number; div: number; fix: number } | null>(null);
  const singleInput = useRef<HTMLInputElement>(null);
  const batchInput = useRef<HTMLInputElement>(null);
  const [singleTarget, setSingleTarget] = useState<string | null>(null);

  const empById = useMemo(() => Object.fromEntries(emps.map((e) => [e.id, e])), [emps]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("validate-worker-list", {
      body: { action: "portal_status", portal_type: "accounting_office", portal_id: accountingOfficeId },
    });
    if (error || data?.error) toast.error(data?.error || "Não foi possível carregar as listas.");
    setEmps(data?.employers || []); setItems(data?.items || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [accountingOfficeId]);

  const validateOne = async (itemId: string, file: File) => {
    const it = items.find((i) => i.id === itemId);
    if (!it) return { ok: false, error: "Lançamento não encontrado." };
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name) && !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) return { ok: false, error: "Formato inválido. Envie PDF, JPG, JPEG ou PNG." };
    if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Arquivo maior que 10 MB." };
    const { data, error } = await supabase.functions.invoke("validate-worker-list", {
      body: {
        contribution_id: it.id, contribution_type_id: it.contribution_type_id || it.contribution_type?.id,
        portal_type: "accounting_office", portal_id: accountingOfficeId,
        file_base64: await toBase64(file), file_name: file.name, mime_type: mimeOf(file),
      },
    });
    if (error || data?.error) return { ok: false, error: data?.error || "Não foi possível validar agora." };
    return { ok: !!data.result?.valido, reason: data.result?.motivo as string };
  };

  const onSingleFile = async (f: File | null) => {
    const id = singleTarget; setSingleTarget(null);
    if (!f || !id) return;
    setRunning((r) => ({ ...r, [id]: true }));
    const r = await validateOne(id, f);
    setRunning((s) => ({ ...s, [id]: false }));
    if (r.ok) toast.success("✅ Lista validada"); else toast.error(`❌ Lista não validada: ${r.error || r.reason}`);
    load();
  };

  // Sugestão (nunca vínculo automático definitivo): CNPJ + competência no nome do arquivo
  const suggest = (name: string): string => {
    const d = name.replace(/\D/g, " ");
    const cnpj = (d.match(/\d{14}/) || [])[0];
    if (!cnpj) return "";
    const m = name.match(/(\d{2})[-_.](\d{4})/);
    const cands = items.filter((i) => digits(empById[i.employer_id]?.cnpj || "") === cnpj);
    const byComp = m ? cands.filter((i) => i.competence_month === Number(m[1]) && i.competence_year === Number(m[2])) : [];
    const pick = byComp.length === 1 ? byComp : cands.length === 1 ? cands : [];
    return pick[0]?.id || "";
  };

  const onBatchFiles = (files: FileList | null) => {
    if (!files) return;
    setSummary(null);
    const rows: BatchRow[] = Array.from(files).map((f, i) => {
      const itemId = suggest(f.name);
      return { key: `${Date.now()}-${i}`, file: f, itemId, auto: !!itemId, state: itemId ? "pronto" : "identificar" };
    });
    setBatch((b) => [...b.filter((r) => r.state !== "ok"), ...rows]);
  };

  const runBatch = async () => {
    const todo = batch.filter((r) => r.itemId && (r.state === "pronto" || r.state === "erro"));
    if (todo.length === 0) return toast.error("Associe cada arquivo a uma empresa/competência antes de validar.");
    const ids = todo.map((t) => t.itemId);
    if (new Set(ids).size !== ids.length) return toast.error("Há dois arquivos para o mesmo lançamento. Deixe apenas um.");
    setBatchRunning(true);
    let ok = 0, div = 0, fix = 0;
    for (const row of todo) {
      setBatch((b) => b.map((r) => (r.key === row.key ? { ...r, state: "validando" } : r)));
      const res = await validateOne(row.itemId, row.file);
      const st: Status = res.ok ? "Validada" : isDivergence(res.reason) ? "Divergência encontrada" : res.error ? "Necessita correção" : "Reprovada";
      if (res.ok) ok++; else if (st === "Divergência encontrada") div++; else fix++;
      setBatch((b) => b.map((r) => (r.key === row.key ? { ...r, state: res.ok ? "ok" : "erro", status: st, message: res.error || res.reason } : r)));
    }
    fix += batch.filter((r) => !r.itemId).length;
    setSummary({ total: todo.length + batch.filter((r) => !r.itemId).length, ok, div, fix });
    setBatchRunning(false);
    load();
  };

  const rows = useMemo(() => {
    const q = fEmp.trim().toLowerCase(); const qd = digits(fEmp);
    return items.filter((i) => {
      const e = empById[i.employer_id];
      if (q && !(`${e?.name} ${e?.trade_name || ""}`.toLowerCase().includes(q) || (qd.length >= 3 && digits(e?.cnpj || "").includes(qd)))) return false;
      if (fType !== "all" && (i.contribution_type_id || i.contribution_type?.id) !== fType) return false;
      if (fComp !== "all" && comp(i) !== fComp) return false;
      if (fStatus !== "all" && statusOf(i.validation, running[i.id]) !== fStatus) return false;
      const sent = i.validation?.created_at?.slice(0, 10);
      if (fFrom && (!sent || sent < fFrom)) return false;
      if (fTo && (!sent || sent > fTo)) return false;
      return true;
    });
  }, [items, empById, fEmp, fType, fComp, fStatus, fFrom, fTo, running]);

  const stats = useMemo(() => {
    const s = items.map((i) => statusOf(i.validation));
    return {
      empresas: emps.length,
      enviadas: items.filter((i) => i.validation).length,
      validadas: s.filter((x) => x === "Validada").length,
      aguardando: s.filter((x) => x === "Aguardando envio").length,
      pendentes: s.filter((x) => ["Reprovada", "Divergência encontrada", "Necessita correção"].includes(x)).length,
    };
  }, [items, emps]);

  const types = useMemo(() => {
    const m = new Map<string, string>();
    items.forEach((i) => { const id = i.contribution_type_id || i.contribution_type?.id; if (id) m.set(id, i.contribution_type?.name || id); });
    return [...m.entries()];
  }, [items]);
  const comps = useMemo(() => [...new Set(items.map(comp))], [items]);
  const itemLabel = (i: Item) => `${empById[i.employer_id]?.name || "Empresa"} • ${fmtCnpj(empById[i.employer_id]?.cnpj || "")} • ${i.contribution_type?.name || ""} • ${comp(i)}`;

  const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[["Total de empresas", stats.empresas], ["Listas enviadas", stats.enviadas], ["Listas validadas", stats.validadas], ["Aguardando envio", stats.aguardando], ["Com pendência", stats.pendentes]].map(([l, v]) => (
          <div key={l as string} className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="text-2xl font-semibold text-foreground">{v}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        Dica: nomeie os arquivos como <code className="text-foreground">CNPJ_TIPO_COMPETENCIA.pdf</code> (ex.: 12345678000190_ASSISTENCIAL_09-2026.pdf). O nome só ajuda a sugerir a empresa — o vínculo é sempre conferido e validado pela análise do documento.
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Input className="w-56" placeholder="Empresa ou CNPJ" value={fEmp} onChange={(e) => setFEmp(e.target.value)} />
        <select className={sel} value={fType} onChange={(e) => setFType(e.target.value)} aria-label="Tipo">
          <option value="all">Todos os tipos</option>{types.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <select className={sel} value={fComp} onChange={(e) => setFComp(e.target.value)} aria-label="Competência">
          <option value="all">Todas competências</option>{comps.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className={sel} value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Status">
          <option value="all">Todos status</option>
          {["Aguardando envio", "Validando", "Validada", "Reprovada", "Divergência encontrada", "Necessita correção"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <Input type="date" className="w-40" value={fFrom} onChange={(e) => setFFrom(e.target.value)} aria-label="Enviado de" />
        <Input type="date" className="w-40" value={fTo} onChange={(e) => setFTo(e.target.value)} aria-label="Enviado até" />
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4 mr-1" />Atualizar</Button>
        <Button size="sm" onClick={() => { setBatchOpen(true); setSummary(null); }}><Files className="h-4 w-4 mr-1" />Enviar listas em lote</Button>
      </div>

      <input ref={singleInput} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { onSingleFile(e.target.files?.[0] || null); e.target.value = ""; }} />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum lançamento aguardando lista para os filtros escolhidos.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>{["Empresa", "CNPJ", "Tipo de contribuição", "Competência", "Lista", "Validação", "Status", "Ações"].map((h) => <th key={h} className="p-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((i) => {
                const e = empById[i.employer_id]; const st = statusOf(i.validation, running[i.id]);
                return (
                  <tr key={i.id}>
                    <td className="p-2 font-medium text-foreground">{e?.name}</td>
                    <td className="p-2 whitespace-nowrap">{fmtCnpj(e?.cnpj || "")}</td>
                    <td className="p-2">{i.contribution_type?.name}</td>
                    <td className="p-2">{comp(i)}</td>
                    <td className="p-2 max-w-[180px] truncate">{i.validation?.file_name || "—"}</td>
                    <td className="p-2 text-xs max-w-[240px]">
                      {st === "Validada" ? `✅ Lista validada${i.validation?.quantidade ? ` • ${i.validation.quantidade} trab.` : ""}`
                        : i.validation?.status === "valid" ? "Validação expirada ou já usada — envie novamente"
                        : i.validation ? <span className="text-destructive">❌ {i.validation.reason}</span> : "—"}
                    </td>
                    <td className="p-2"><Badge variant={badgeVariant(st)}>{st === "Validando" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}{st}</Badge></td>
                    <td className="p-2">
                      <Button size="sm" variant="outline" disabled={running[i.id]} onClick={() => { setSingleTarget(i.id); singleInput.current?.click(); }}>
                        <Upload className="h-4 w-4 mr-1" />{i.validation ? (st === "Validada" ? "Substituir arquivo" : "Validar novamente") : "Enviar lista"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={batchOpen} onOpenChange={(o) => !batchRunning && setBatchOpen(o)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar listas em lote</DialogTitle>
            <DialogDescription>Selecione vários arquivos. Confira a empresa sugerida de cada um (ou escolha manualmente) antes de validar.</DialogDescription>
          </DialogHeader>
          <input ref={batchInput} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { onBatchFiles(e.target.files); e.target.value = ""; }} />
          <Button variant="outline" onClick={() => batchInput.current?.click()} disabled={batchRunning}><Upload className="h-4 w-4 mr-2" />Selecionar arquivos (PDF, JPG, JPEG, PNG)</Button>

          {batch.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left"><tr>{["Arquivo", "Empresa / Tipo / Competência", "Situação", ""].map((h) => <th key={h} className="p-2 font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {batch.map((r) => (
                    <tr key={r.key}>
                      <td className="p-2 max-w-[200px] truncate">{r.file.name}</td>
                      <td className="p-2">
                        <select className={`${sel} w-full max-w-[460px]`} value={r.itemId} disabled={batchRunning || r.state === "ok"}
                          onChange={(e) => setBatch((b) => b.map((x) => (x.key === r.key ? { ...x, itemId: e.target.value, auto: false, state: e.target.value ? "pronto" : "identificar", message: undefined, status: undefined } : x)))}>
                          <option value="">— Selecione a empresa —</option>
                          {items.map((i) => <option key={i.id} value={i.id}>{itemLabel(i)}</option>)}
                        </select>
                        {r.auto && r.state === "pronto" && <div className="text-xs text-muted-foreground mt-1">Sugerido pelo nome do arquivo — confira.</div>}
                      </td>
                      <td className="p-2 text-xs">
                        {r.state === "identificar" && <span className="text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Identificação necessária</span>}
                        {r.state === "pronto" && "Pronto"}
                        {r.state === "validando" && <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Validando...</span>}
                        {r.state === "ok" && <span className="text-primary flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Lista validada</span>}
                        {r.state === "erro" && <span className="text-destructive"><XCircle className="h-3 w-3 inline mr-1" />{r.status === "Divergência encontrada" ? "⚠️ Divergência encontrada: " : "Lista não validada: "}{r.message}</span>}
                      </td>
                      <td className="p-2"><Button size="sm" variant="ghost" disabled={batchRunning} onClick={() => setBatch((b) => b.filter((x) => x.key !== r.key))}>Remover</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {summary && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="font-medium text-foreground mb-1">Processamento concluído</div>
              <ul className="list-disc pl-5 text-muted-foreground">
                <li>{summary.total} arquivo(s) selecionado(s)</li>
                <li>{summary.ok} lista(s) validada(s)</li>
                <li>{summary.div} lista(s) com divergência</li>
                <li>{summary.fix} lista(s) aguardando correção</li>
              </ul>
            </div>
          )}

          <DialogFooter className="gap-2">
            {summary && (summary.div + summary.fix) > 0 && (
              <Button variant="outline" onClick={() => { setBatchOpen(false); setFStatus("all"); setFEmp(""); toast.info("Pendências marcadas na tabela. Use 'Validar novamente' para substituir o arquivo."); }}>Ver pendências</Button>
            )}
            <Button onClick={runBatch} disabled={batchRunning || !batch.some((r) => r.itemId && (r.state === "pronto" || r.state === "erro"))}>
              {batchRunning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Validar listas selecionadas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
