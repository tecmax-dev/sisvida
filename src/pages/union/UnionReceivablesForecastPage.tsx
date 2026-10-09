import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Loader2, RefreshCw, ExternalLink, Printer, FileDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  employers: { name: string | null; cnpj: string | null } | null;
}

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => (d ? parseDateOnlyToLocalNoon(d).toLocaleDateString("pt-BR") : "-");

export default function UnionReceivablesForecastPage() {
  const navigate = useNavigate();
  const openBoleto = (url: string | null) => {
    if (!url) return;
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = url;
  };
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

  const load = async () => {
    setLoading(true);
    const all: Row[] = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await supabase
        .from("employer_contributions")
        .select("id, employer_id, contribution_type_id, competence_month, competence_year, value, due_date, status, lytex_invoice_url, employers(name, cnpj)")
        .eq("clinic_id", SINDICATO_CLINIC_ID)
        .in("contribution_type_id", Object.keys(TYPES))
        .in("status", ["pending", "overdue"])
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
all.filter((r) => Number(r.value) > 0),
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
    let total = 0, overdue = 0, upcoming = 0, awaiting = 0;
    for (const r of filtered) {
      const v = Number(r.value) || 0;
      total += v;
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
    return { byType, byMonth, total, overdue, upcoming, awaiting };
  }, [filtered]);

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Previsão de recebimento - Contribuições 124, 125 e 126", 14, 14);
    doc.setFontSize(10);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}  |  Total: ${brl(totals.total)}  |  A vencer: ${brl(totals.upcoming)}  |  Vencidos: ${brl(totals.overdue)}  |  Boletos: ${filtered.length}`, 14, 21);
    autoTable(doc, {
      startY: 26,
      head: [["Tipo", "Qtd.", "Valor"]],
      body: Object.entries(TYPES).map(([id, l]) => [l, String(totals.byType[id]?.count ?? 0), brl(totals.byType[id]?.value ?? 0)]),
      styles: { fontSize: 9 },
    });
    autoTable(doc, {
      head: [["Empresa", "CNPJ", "Tipo", "Comp.", "Vencimento", "Valor", "Situação"]],
      body: filtered.map((r) => [
        r.employers?.name ?? "-", r.employers?.cnpj ?? "", TYPES[r.contribution_type_id],
        `${String(r.competence_month).padStart(2, "0")}/${r.competence_year}`, fmtDate(r.due_date),
        brl(Number(r.value) || 0), STATUS[r.status]?.label ?? r.status,
      ]),
      styles: { fontSize: 8 },
    });
    doc.save("previsao-recebimento.pdf");
  };

  const monthLabel = (k: string) => (k === "sem-data" ? "Sem vencimento" : `${k.slice(5, 7)}/${k.slice(0, 4)}`);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Previsão de recebimento</h1>
            <p className="text-sm text-muted-foreground">
              Boletos não pagos (a vencer e vencidos) e contribuições criadas a partir de 09/2026 — tipos 124, 125 e 126.
            </p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
        <Button variant="outline" onClick={() => window.print()} disabled={loading}>
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
        <Button variant="outline" onClick={exportPdf} disabled={loading}>
          <FileDown className="mr-2 h-4 w-4" /> PDF
        </Button>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total previsto</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{brl(totals.total)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">A vencer</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{brl(totals.upcoming)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Vencidos</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-destructive">{brl(totals.overdue)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Boletos</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{filtered.length}</CardContent></Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Por tipo</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead className="text-right">Qtd.</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {Object.entries(TYPES).map(([id, label]) => (
                      <TableRow key={id}><TableCell>{label}</TableCell><TableCell className="text-right">{totals.byType[id]?.count ?? 0}</TableCell><TableCell className="text-right">{brl(totals.byType[id]?.value ?? 0)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Por mês de vencimento</CardTitle></CardHeader>
              <CardContent className="max-h-80 overflow-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Qtd.</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {Object.entries(totals.byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => (
                      <TableRow key={k}><TableCell>{monthLabel(k)}</TableCell><TableCell className="text-right">{v.count}</TableCell><TableCell className="text-right">{brl(v.value)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Boletos ({filtered.length})</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Input className="max-w-xs" placeholder="Buscar empresa ou CNPJ" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="all">Todos os tipos</option>
                  {Object.entries(TYPES).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
                </select>
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">Todas as situações</option>
                  {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                {[["all","Tudo"],["overdue","Vencidos"],["month","Vence este mês"],["next30","Próximos 30 dias"],["new2026","A partir de 09/2026"]].map(([k,l]) => (
                  <Button key={k} size="sm" variant={quick === k ? "default" : "outline"} onClick={() => setQuick(k)}>{l}</Button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="text-xs text-muted-foreground">Competência de
                  <Input type="month" value={compFrom} onChange={(e) => setCompFrom(e.target.value)} /></label>
                <label className="text-xs text-muted-foreground">Competência até
                  <Input type="month" value={compTo} onChange={(e) => setCompTo(e.target.value)} /></label>
                <label className="text-xs text-muted-foreground">Vencimento de
                  <Input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} /></label>
                <label className="text-xs text-muted-foreground">Vencimento até
                  <Input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} /></label>
                <label className="text-xs text-muted-foreground">Valor
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={valueFilter} onChange={(e) => setValueFilter(e.target.value)}>
                    <option value="all">Todos</option>
                    <option value="with">Com valor</option>
                    <option value="high">A partir de R$ 1.000</option>
                  </select></label>
              </div>
              <div>
                <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setTypeFilter("all"); setStatusFilter("all"); setCompFrom(""); setCompTo(""); setDueFrom(""); setDueTo(""); setValueFilter("all"); setQuick("all"); }}>Limpar filtros</Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead><TableHead>Tipo</TableHead><TableHead>Competência</TableHead>
                    <TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Situação</TableHead><TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 500).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="cursor-pointer" onClick={() => navigate(`/union/empresas/${r.employer_id}`)}><div className="font-medium text-primary hover:underline">{r.employers?.name ?? "-"}</div><div className="text-xs text-muted-foreground">{r.employers?.cnpj ?? ""}</div></TableCell>
                      <TableCell className="text-sm">{TYPES[r.contribution_type_id]}</TableCell>
                      <TableCell>{String(r.competence_month).padStart(2, "0")}/{r.competence_year}</TableCell>
                      <TableCell>{fmtDate(r.due_date)}</TableCell>
                      <TableCell className={`text-right ${r.lytex_invoice_url ? "cursor-pointer text-primary hover:underline" : ""}`} onClick={() => openBoleto(r.lytex_invoice_url)}>{r.value ? brl(Number(r.value)) : "-"}</TableCell>
                      <TableCell><Badge variant={STATUS[r.status]?.variant ?? "secondary"}>{STATUS[r.status]?.label ?? r.status}</Badge></TableCell>
                      <TableCell>
                        {r.lytex_invoice_url && (
                          <Button size="sm" variant="ghost" title="Abrir boleto" onClick={() => openBoleto(r.lytex_invoice_url)}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length > 500 && <p className="mt-3 text-sm text-muted-foreground">Mostrando os 500 primeiros. Use a busca ou os filtros para refinar.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
