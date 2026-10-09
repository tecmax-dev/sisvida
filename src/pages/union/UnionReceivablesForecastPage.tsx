import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Loader2, RefreshCw, ExternalLink, Printer, FileDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const TYPES: Record<string, string> = {
  "48bda88b-1cf9-47b6-b930-781d8a0eb55a": "124 - Mensalidade Sindical",
  "b9c234de-e13b-4c10-a880-616ec4abc66b": "125 - Taxa Negocial (Mercados)",
  "575887e1-45d3-41e1-9249-5581fe657f54": "126 - Taxa Negocial (Com. Varej.)",
};

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "A vencer", variant: "default" },
  overdue: { label: "Vencido", variant: "destructive" },
  paid: { label: "Pago", variant: "secondary" },
};

interface Row {
  id: string;
  employer_id: string;
  contribution_type_id: string;
  competence_month: number;
  competence_year: number;
  value: number | null;
  due_date: string | null;
  status: string;
  lytex_invoice_url: string | null;
  paid_value: number | null;
  paid_at: string | null;
  lytex_fee_amount: number | null;
  net_value: number | null;
  employers: { name: string | null; cnpj: string | null } | null;
}

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => (d ? parseDateOnlyToLocalNoon(d).toLocaleDateString("pt-BR") : "-");

export default function UnionReceivablesForecastPage() {
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);
  const syncPayments = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("lytex-api", { body: { action: "sync_all_pending", clinicId: SINDICATO_CLINIC_ID } });
      if (error) throw error;
      const n = (data as { updated?: number })?.updated ?? 0;
      if (n > 0) toast.success(`${n} contribuição(ões) atualizada(s) como pagas`);
      else toast.info("Nenhum novo pagamento encontrado");
      for (let off = 0, i = 0; i < 30; i++) {
        const { data: fd, error: fe } = await supabase.functions.invoke("lytex-reconcile-open", { body: { clinicId: SINDICATO_CLINIC_ID, mode: "fees", offset: off, limit: 100, typeIds: Object.keys(TYPES) } });
        if (fe) break;
        const res = fd as { done?: boolean; nextOffset?: number };
        if (res?.done || res?.nextOffset == null) break;
        off = res.nextOffset;
      }
      await load();
    } catch (e) {
      toast.error(`Erro ao sincronizar: ${e instanceof Error ? e.message : "erro desconhecido"}`);
    } finally {
      setSyncing(false);
    }
  };
  const [boletoUrl, setBoletoUrl] = useState<string | null>(null);
  const [companyRow, setCompanyRow] = useState<Row | null>(null);
  const openBoleto = (url: string | null) => { if (url) setBoletoUrl(url); };
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [compFrom, setCompFrom] = useState("");
  const [compTo, setCompTo] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [valueFilter, setValueFilter] = useState("all");
  const [quick, setQuick] = useState("all");
  const [page, setPage] = useState(1);
  const [showMore, setShowMore] = useState(false);
  const [showFee, setShowFee] = useState(true);
  const netOf = (r: Row) => {
    if (r.status !== "paid") return "-";
    if (r.net_value != null) return brl(Number(r.net_value));
    if (r.lytex_fee_amount == null) return "-";
    return brl((Number(r.paid_value ?? r.value) || 0) - Number(r.lytex_fee_amount));
  };

  const load = async () => {
    setLoading(true);
    const all: Row[] = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await supabase
        .from("employer_contributions")
        .select("id, employer_id, contribution_type_id, competence_month, competence_year, value, due_date, status, lytex_invoice_url, paid_value, paid_at, lytex_fee_amount, net_value, employers(name, cnpj)")
        .eq("clinic_id", SINDICATO_CLINIC_ID)
        .in("contribution_type_id", Object.keys(TYPES))
        .or("status.in.(pending,overdue),and(status.eq.paid,competence_year.gte.2026)")
        .gt("value", 0)
        .order("due_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + page - 1);
      if (error || !data) break;
      all.push(...(data as unknown as Row[]));
      if (data.length < page) break;
    }
    // Boletos já criados e não pagos (a vencer/vencidos) + todos criados a partir de 09/2026
    setRows(
all.filter((r) => Number(r.value) > 0 && (r.status !== "paid" || r.competence_year * 100 + r.competence_month >= 202609)),
    );
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.contribution_type_id !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      const ck = `${r.competence_year}-${String(r.competence_month).padStart(2, "0")}`;
      if (compFrom && ck < compFrom) return false;
      if (compTo && ck > compTo) return false;
      const due = r.due_date ?? "";
      if (dueFrom && (!due || due < dueFrom)) return false;
      if (dueTo && (!due || due > dueTo)) return false;
      const v = Number(r.value) || 0;
      if (valueFilter === "with" && v <= 0) return false;
      if (valueFilter === "without" && v > 0) return false;
      if (valueFilter === "high" && v < 100000) return false;
      if (quick !== "all") {
        const t = new Date();
        const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const today = iso(t);
        if (quick === "overdue" && !(r.status === "overdue" || (due && due < today && r.status === "pending"))) return false;
        if (quick === "month" && due.slice(0, 7) !== today.slice(0, 7)) return false;
        if (quick === "next30") {
          const lim = new Date(t); lim.setDate(lim.getDate() + 30);
          if (!due || due < today || due > iso(lim)) return false;
        }
        if (quick === "new2026" && ck < "2026-09") return false;
      }
      if (!q) return true;
      const name = (r.employers?.name ?? "").toLowerCase();
      const cnpj = (r.employers?.cnpj ?? "").replace(/\D/g, "");
      return name.includes(q) || (qd.length > 0 && cnpj.includes(qd));
    });
  }, [rows, search, typeFilter, statusFilter, compFrom, compTo, dueFrom, dueTo, valueFilter, quick]);

  const totals = useMemo(() => {
    const byType: Record<string, { count: number; value: number }> = {};
    const byMonth: Record<string, { count: number; value: number }> = {};
    let total = 0, overdue = 0, upcoming = 0, awaiting = 0, received = 0, open = 0, fees = 0, net = 0;
    for (const r of filtered) {
      const v = r.status === "paid" ? Number(r.paid_value ?? r.value) || 0 : Number(r.value) || 0;
      if (r.status === "paid") {
        received += v;
        const f = Number(r.lytex_fee_amount) || 0;
        fees += f;
        net += r.net_value != null ? Number(r.net_value) : v - f;
        if (statusFilter !== "paid") continue;
      } else {
        open++;
        total += v;
      }
      if (r.status === "overdue") overdue += v;
      else if (r.status === "pending") upcoming += v;
      else awaiting += 1;
      byType[r.contribution_type_id] ??= { count: 0, value: 0 };
      byType[r.contribution_type_id].count++;
      byType[r.contribution_type_id].value += v;
      const mk = r.due_date ? r.due_date.slice(0, 7) : "sem-data";
      byMonth[mk] ??= { count: 0, value: 0 };
      byMonth[mk].count++;
      byMonth[mk].value += v;
    }
    return { byType, byMonth, total, overdue, upcoming, awaiting, received, open, fees, net };
  }, [filtered, statusFilter]);

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Previsão de recebimento - Contribuições 124, 125 e 126", 14, 14);
    doc.setFontSize(10);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}  |  Total: ${brl(totals.total)}  |  A vencer: ${brl(totals.upcoming)}  |  Vencidos: ${brl(totals.overdue)}  |  Boletos: ${filtered.length}`, 14, 21);
    doc.text(`Recebido bruto: ${brl(totals.received)}  |  Taxas Lytex: ${brl(totals.fees)}  |  Líquido: ${brl(totals.net)}`, 14, 27);
    autoTable(doc, {
      startY: 32,
      head: [["Tipo", "Qtd.", "Valor"]],
      body: Object.entries(TYPES).map(([id, l]) => [l, String(totals.byType[id]?.count ?? 0), brl(totals.byType[id]?.value ?? 0)]),
      styles: { fontSize: 9 },
    });
    autoTable(doc, {
      head: [["Empresa", "CNPJ", "Tipo", "Comp.", "Vencimento", "Valor bruto", ...(showFee ? ["Taxa Lytex", "Líquido"] : []), "Situação"]],
      body: filtered.map((r) => [
        r.employers?.name ?? "-", r.employers?.cnpj ?? "", TYPES[r.contribution_type_id],
        `${String(r.competence_month).padStart(2, "0")}/${r.competence_year}`, fmtDate(r.due_date),
        brl(Number(r.value) || 0),
        ...(showFee ? [r.lytex_fee_amount != null ? brl(Number(r.lytex_fee_amount)) : "-", netOf(r)] : []),
        STATUS[r.status]?.label ?? r.status,
      ]),
      styles: { fontSize: 8 },
    });
    doc.save("previsao-recebimento.pdf");
  };

  const PAGE_SIZE = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const monthLabel = (k: string) => (k === "sem-data" ? "Sem vencimento" : `${k.slice(5, 7)}/${k.slice(0, 4)}`);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Previsão de recebimento</h1>
            <p className="text-sm text-muted-foreground">
              Boletos não pagos (a vencer e vencidos) e contribuições criadas a partir de 09/2026 — tipos 124, 125 e 126.
            </p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
        <Button size="sm" variant="outline" onClick={() => window.print()} disabled={loading}>
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
        <Button size="sm" variant="outline" onClick={exportPdf} disabled={loading}>
          <FileDown className="mr-2 h-4 w-4" /> PDF
        </Button>
        <Button size="sm" onClick={() => void syncPayments()} disabled={loading || syncing}>
          {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Sincronizar pagamentos
        </Button>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              ["Total previsto", brl(totals.total), ""],
              ["A vencer", brl(totals.upcoming), ""],
              ["Vencidos", brl(totals.overdue), "text-destructive"],
              ["Recebido bruto (desde 09/2026)", brl(totals.received), "text-primary"],
              ["Taxas Lytex", brl(totals.fees), "text-muted-foreground"],
              ["Recebido líquido", brl(totals.net), "text-primary"],
            ].map(([l, v, c]) => (
              <div key={l} className="rounded-lg border bg-card px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{l}</p>
                <p className={`mt-1 text-xl font-semibold tabular-nums ${c}`}>{v}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border bg-card">
              <p className="border-b px-4 py-2 text-sm font-semibold">Por tipo</p>
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(TYPES).map(([id, label]) => (
                    <tr key={id} className="border-b last:border-0">
                      <td className="px-4 py-1.5">{label}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{totals.byType[id]?.count ?? 0}</td>
                      <td className="px-4 py-1.5 text-right font-medium tabular-nums">{brl(totals.byType[id]?.value ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border bg-card">
              <p className="border-b px-4 py-2 text-sm font-semibold">Por mês de vencimento</p>
              <div className="max-h-[118px] overflow-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(totals.byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => (
                      <tr key={k} className="border-b last:border-0">
                        <td className="px-4 py-1.5">{monthLabel(k)}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{v.count}</td>
                        <td className="px-4 py-1.5 text-right font-medium tabular-nums">{brl(v.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            <div className="space-y-3 border-b p-4 print:hidden">
              <div className="flex flex-wrap items-center gap-2">
                <Input className="h-9 w-full sm:w-64" placeholder="Buscar empresa ou CNPJ" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="all">Todos os tipos</option>
                  {Object.entries(TYPES).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
                </select>
                <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">Todas as situações</option>
                  {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                </select>
                <label className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm">
                  <input type="checkbox" checked={showFee} onChange={(e) => setShowFee(e.target.checked)} />
                  Mostrar taxa Lytex
                </label>
                <Button size="sm" variant="outline" className="h-9" onClick={() => setShowMore((v) => !v)}>{showMore ? "Menos filtros" : "Mais filtros"}</Button>
                <Button size="sm" variant="ghost" className="h-9" onClick={() => { setSearch(""); setTypeFilter("all"); setStatusFilter("all"); setCompFrom(""); setCompTo(""); setDueFrom(""); setDueTo(""); setValueFilter("all"); setQuick("all"); }}>Limpar</Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[["all","Tudo"],["overdue","Vencidos"],["month","Vence este mês"],["next30","Próximos 30 dias"],["new2026","A partir de 09/2026"]].map(([k,l]) => (
                  <Button key={k} size="sm" className="h-7 rounded-full px-3 text-xs" variant={quick === k ? "default" : "outline"} onClick={() => setQuick(k)}>{l}</Button>
                ))}
              </div>
              {showMore && (
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  <label className="text-xs text-muted-foreground">Competência de<Input className="h-9" type="month" value={compFrom} onChange={(e) => setCompFrom(e.target.value)} /></label>
                  <label className="text-xs text-muted-foreground">Competência até<Input className="h-9" type="month" value={compTo} onChange={(e) => setCompTo(e.target.value)} /></label>
                  <label className="text-xs text-muted-foreground">Vencimento de<Input className="h-9" type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} /></label>
                  <label className="text-xs text-muted-foreground">Vencimento até<Input className="h-9" type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} /></label>
                  <label className="text-xs text-muted-foreground">Valor
                    <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" value={valueFilter} onChange={(e) => setValueFilter(e.target.value)}>
                      <option value="all">Todos</option>
                      <option value="with">Com valor</option>
                      <option value="high">A partir de R$ 1.000</option>
                    </select></label>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Empresa</th>
                    <th className="px-3 py-2 text-left font-medium">Tipo</th>
                    <th className="px-3 py-2 text-left font-medium">Comp.</th>
                    <th className="px-3 py-2 text-left font-medium">Vencimento</th>
                    <th className="px-3 py-2 text-right font-medium">Valor bruto</th>
                    {showFee && <th className="px-3 py-2 text-right font-medium">Taxa Lytex</th>}
                    {showFee && <th className="px-3 py-2 text-right font-medium">Líquido</th>}
                    <th className="px-3 py-2 text-left font-medium">Situação</th>
                    <th className="w-10 px-2 py-2 print:hidden" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="max-w-[280px] px-4 py-2">
                        <button className="block w-full truncate text-left font-medium text-primary hover:underline" title={r.employers?.name ?? ""} onClick={() => setCompanyRow(r)}>{r.employers?.name ?? "-"}</button>
                        <span className="text-xs text-muted-foreground">{r.employers?.cnpj ?? ""}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{TYPES[r.contribution_type_id]?.slice(0, 3)} · {TYPES[r.contribution_type_id]?.split(" - ")[1]?.replace("Taxa Negocial ", "TN ")}</td>
                      <td className="px-3 py-2 tabular-nums">{String(r.competence_month).padStart(2, "0")}/{r.competence_year}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtDate(r.due_date)}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{r.value ? brl(Number(r.value)) : "-"}</td>
                      {showFee && <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.lytex_fee_amount != null ? brl(Number(r.lytex_fee_amount)) : "-"}</td>}
                      {showFee && <td className="px-3 py-2 text-right font-medium tabular-nums">{netOf(r)}</td>}
                      <td className="px-3 py-2"><Badge className="text-[11px]" variant={STATUS[r.status]?.variant ?? "secondary"}>{STATUS[r.status]?.label ?? r.status}</Badge></td>
                      <td className="px-2 py-2 print:hidden">
                        {r.lytex_invoice_url && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Abrir boleto" onClick={() => openBoleto(r.lytex_invoice_url)}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && <tr><td colSpan={showFee ? 9 : 7} className="px-4 py-10 text-center text-muted-foreground">Nenhum boleto encontrado.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-sm text-muted-foreground print:hidden">
              <span>{filtered.length} boleto(s) · página {safePage} de {pageCount}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-8" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Anterior</Button>
                <Button size="sm" variant="outline" className="h-8" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>Próxima</Button>
              </div>
            </div>
          </div>
        </>
      )}
          <Dialog open={!!boletoUrl} onOpenChange={(o) => !o && setBoletoUrl(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>Boleto</DialogTitle></DialogHeader>
          {boletoUrl && <iframe src={boletoUrl} title="Boleto" className="h-[75vh] w-full rounded-md border" />}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => boletoUrl && window.open(boletoUrl, "_blank", "noopener,noreferrer")}>
              <ExternalLink className="mr-2 h-4 w-4" /> Abrir em nova aba
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!companyRow} onOpenChange={(o) => !o && setCompanyRow(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{companyRow?.employers?.name ?? "Empresa"}</DialogTitle></DialogHeader>
          {companyRow && (() => {
            const list = rows.filter((x) => x.employer_id === companyRow.employer_id);
            const sum = list.reduce((a, x) => a + (Number(x.value) || 0), 0);
            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">CNPJ: {companyRow.employers?.cnpj ?? "-"} · {list.length} boleto(s) em aberto · Total {brl(sum)}</p>
                <div className="max-h-[55vh] overflow-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Comp.</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Situação</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>
                      {list.map((x) => (
                        <TableRow key={x.id}>
                          <TableCell className="text-sm">{TYPES[x.contribution_type_id]}</TableCell>
                          <TableCell>{String(x.competence_month).padStart(2, "0")}/{x.competence_year}</TableCell>
                          <TableCell>{fmtDate(x.due_date)}</TableCell>
                          <TableCell className="text-right">{brl(Number(x.value) || 0)}</TableCell>
                          <TableCell><Badge variant={STATUS[x.status]?.variant ?? "secondary"}>{STATUS[x.status]?.label ?? x.status}</Badge></TableCell>
                          <TableCell>{x.lytex_invoice_url && <Button size="sm" variant="ghost" onClick={() => openBoleto(x.lytex_invoice_url)}><ExternalLink className="h-4 w-4" /></Button>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => window.open(`/union/empresas/${companyRow.employer_id}`, "_blank")}>Ver cadastro completo</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
</div>
  );
}
