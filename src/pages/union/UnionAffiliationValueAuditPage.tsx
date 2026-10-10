import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Download, Loader2, Search, TrendingUp, TrendingDown, Minus, AlertTriangle, Users, Building2 } from "lucide-react";
import { parseDateOnlyToLocalNoon } from "@/lib/date";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ym = (y: number, m: number) => y * 100 + m;
const ymLabel = (k: number) => `${String(k % 100).padStart(2, "0")}/${Math.floor(k / 100)}`;
const MENS_RE = /(MENSALIDADE SINDICAL|MENS SIND|^MENSALIDADE$)/i;

type Status = "updated" | "unchanged" | "decreased" | "no_after" | "no_before";
const STATUS: Record<Status, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  updated: { label: "Valor aumentou", variant: "default", icon: TrendingUp },
  unchanged: { label: "Sem alteração", variant: "destructive", icon: Minus },
  decreased: { label: "Valor diminuiu", variant: "destructive", icon: TrendingDown },
  no_after: { label: "Sem boleto após ficha", variant: "secondary", icon: AlertTriangle },
  no_before: { label: "Sem histórico anterior", variant: "outline", icon: AlertTriangle },
};

interface Doc { employer_id: string; worker_name: string | null; worker_cpf: string | null; approved_at: string | null; made_available_at: string | null; ack_status: string | null; }
interface Contrib { employer_id: string; competence_year: number; competence_month: number; value: number; status: string; }
interface Row {
  employerId: string; name: string; cnpj: string; docs: Doc[]; firstKey: number;
  baseline: number | null; baselineKey: number | null; after: { key: number; value: number }[];
  lastAfter: number | null; diff: number | null; status: Status; acked: number;
}

export default function UnionAffiliationValueAuditPage() {
  const { currentClinic } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [month, setMonth] = useState<string>("all");
  const [sort, setSort] = useState<string>("affiliations");
  const [startDate, setStartDate] = useState("2026-01-01");

  useEffect(() => {
    if (!currentClinic?.id) return;
    (async () => {
      setLoading(true);
      const clinicId = currentClinic.id;
      const { data: docs } = await supabase
        .from("affiliation_company_documents")
        .select("employer_id, worker_name, worker_cpf, approved_at, made_available_at, ack_status, created_at")
        .eq("clinic_id", clinicId).not("employer_id", "is", null)
        .gte("created_at", startDate + "T00:00:00").order("created_at").order("id");
      const byEmp = new Map<string, Doc[]>();
      (docs || []).forEach((d: any) => {
        const arr = byEmp.get(d.employer_id) || []; arr.push(d); byEmp.set(d.employer_id, arr);
      });
      const empIds = [...byEmp.keys()];
      if (!empIds.length) { setRows([]); setLoading(false); return; }

      const [{ data: types }, { data: emps }] = await Promise.all([
        supabase.from("contribution_types").select("id,name").eq("clinic_id", clinicId),
        supabase.from("employers").select("id,name,trade_name,cnpj").in("id", empIds),
      ]);
      const mensIds = (types || []).filter((t: any) => MENS_RE.test(t.name) && !/INDIVIDUAL/i.test(t.name)).map((t: any) => t.id);

      const contribs: Contrib[] = [];
      for (let i = 0; i < empIds.length; i += 100) {
        let from = 0;
        while (true) {
          const { data } = await supabase.from("employer_contributions")
            .select("employer_id,competence_year,competence_month,value,status")
            .in("employer_id", empIds.slice(i, i + 100)).in("contribution_type_id", mensIds)
            .is("member_id", null).neq("status", "cancelled").gte("competence_year", 2025)
            .order("id").range(from, from + 999);
          contribs.push(...((data as Contrib[]) || []));
          if (!data || data.length < 1000) break;
          from += 1000;
        }
      }

      const out: Row[] = empIds.map((id) => {
        const e: any = (emps || []).find((x: any) => x.id === id) || {};
        const ds = byEmp.get(id)!;
        const firstDate = ds.map((d) => d.made_available_at || d.approved_at).filter(Boolean).sort()[0] || startDate;
        const fd = new Date(firstDate);
        const firstKey = ym(fd.getFullYear(), fd.getMonth() + 1);
        const perMonth = new Map<number, number>();
        contribs.filter((c) => c.employer_id === id).forEach((c) => {
          const k = ym(c.competence_year, c.competence_month);
          perMonth.set(k, (perMonth.get(k) || 0) + (c.value || 0));
        });
        const keys = [...perMonth.keys()].sort((a, b) => a - b);
        const beforeKeys = keys.filter((k) => k < firstKey && perMonth.get(k)! > 0);
        const baselineKey = beforeKeys.length ? beforeKeys[beforeKeys.length - 1] : null;
        const baseline = baselineKey ? perMonth.get(baselineKey)! : null;
        const after = keys.filter((k) => k >= firstKey).map((k) => ({ key: k, value: perMonth.get(k)! }));
        const lastAfter = after.filter((a) => a.value > 0).slice(-1)[0]?.value ?? null;
        let st: Status;
        if (lastAfter == null) st = "no_after";
        else if (baseline == null) st = "no_before";
        else if (lastAfter > baseline) st = "updated";
        else if (lastAfter < baseline) st = "decreased";
        else st = "unchanged";
        return {
          employerId: id, name: e.trade_name || e.name || "Empresa", cnpj: e.cnpj || "", docs: ds, firstKey,
          baseline, baselineKey, after, lastAfter, diff: baseline != null && lastAfter != null ? lastAfter - baseline : null,
          status: st, acked: ds.filter((d) => d.ack_status === "confirmed").length,
        };
      });
      setRows(out);
      setLoading(false);
    })();
  }, [currentClinic?.id, startDate]);

  const months = useMemo(() => [...new Set(rows.map((r) => r.firstKey))].sort(), [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase(); const qd = q.replace(/\D/g, "");
    let r = rows.filter((x) =>
      (status === "all" || x.status === status) && (month === "all" || String(x.firstKey) === month) &&
      (!q || x.name.toLowerCase().includes(q) || (qd && x.cnpj.replace(/\D/g, "").includes(qd)) ||
        x.docs.some((d) => (d.worker_name || "").toLowerCase().includes(q))));
    r = [...r].sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) :
      sort === "diff" ? (a.diff ?? -Infinity) - (b.diff ?? -Infinity) :
      sort === "date" ? a.firstKey - b.firstKey : b.docs.length - a.docs.length);
    return r;
  }, [rows, search, status, month, sort]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { updated: 0, unchanged: 0, decreased: 0, no_after: 0, no_before: 0 };
    rows.forEach((r) => c[r.status]++);
    return c;
  }, [rows]);
  const totalDocs = rows.reduce((a, r) => a + r.docs.length, 0);

  const exportCsv = () => {
    const head = ["Empresa", "CNPJ", "Fichas", "Ciência confirmada", "1ª ficha (mês)", "Valor antes", "Competência antes", "Último valor após", "Diferença", "Situação", "Trabalhadores"];
    const lines = filtered.map((r) => [r.name, r.cnpj, r.docs.length, r.acked, ymLabel(r.firstKey),
      r.baseline != null ? (r.baseline / 100).toFixed(2) : "", r.baselineKey ? ymLabel(r.baselineKey) : "",
      r.lastAfter != null ? (r.lastAfter / 100).toFixed(2) : "", r.diff != null ? (r.diff / 100).toFixed(2) : "",
      STATUS[r.status].label, r.docs.map((d) => d.worker_name).join(" | ")]);
    const csv = [head, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `auditoria-filiacoes-valores.csv`; a.click();
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Auditoria: Filiações x Valor dos Boletos</h1>
          <p className="text-muted-foreground">Verifica se as empresas corrigiram o valor da Mensalidade Sindical após receberem as novas fichas de filiação.</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" />Empresas</p><p className="text-2xl font-semibold">{rows.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Fichas</p><p className="text-2xl font-semibold">{totalDocs}</p></CardContent></Card>
        {(Object.keys(STATUS) as Status[]).filter((k) => k !== "no_before").map((k) => (
          <Card key={k} className={`cursor-pointer ${status === k ? "ring-2 ring-primary" : ""}`} onClick={() => setStatus(status === k ? "all" : k)}>
            <CardContent className="p-4"><p className="text-xs text-muted-foreground">{STATUS[k].label}</p><p className="text-2xl font-semibold">{counts[k]}</p></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-5">
          <div className="space-y-1 md:col-span-2"><Label className="text-xs">Pesquisar</Label>
            <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Empresa, CNPJ ou trabalhador" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
          <div className="space-y-1"><Label className="text-xs">Fichas enviadas desde</Label>
            <Input type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Mês da 1ª ficha</Label>
            <Select value={month} onValueChange={setMonth}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem>{months.map((m) => <SelectItem key={m} value={String(m)}>{ymLabel(m)}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label className="text-xs">Ordenar por</Label>
            <Select value={sort} onValueChange={setSort}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="affiliations">Mais fichas</SelectItem>
                <SelectItem value="diff">Menor diferença</SelectItem>
                <SelectItem value="date">Data da ficha</SelectItem>
                <SelectItem value="name">Nome</SelectItem>
              </SelectContent></Select></div>
          <div className="md:col-span-5 flex flex-wrap gap-2">
            {(["all", ...Object.keys(STATUS)] as string[]).map((k) => (
              <Button key={k} size="sm" variant={status === k ? "default" : "outline"} onClick={() => setStatus(k)}>
                {k === "all" ? "Todas" : STATUS[k as Status].label} {k !== "all" && `(${counts[k]})`}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Empresas com novas filiações</CardTitle>
          <CardDescription>"Valor antes" = última Mensalidade Sindical antes da 1ª ficha; "Após" = última competência gerada depois. Clique para ver mês a mês e os trabalhadores.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          : !filtered.length ? <p className="text-center py-10 text-muted-foreground">Nenhuma empresa encontrada.</p>
          : (
            <div className="space-y-2">
              {filtered.map((r) => {
                const S = STATUS[r.status];
                return (
                  <Collapsible key={r.employerId} className="rounded-lg border">
                    <CollapsibleTrigger className="w-full p-3 flex flex-wrap items-center gap-3 text-left hover:bg-muted/40">
                      <div className="flex-1 min-w-[200px]">
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.cnpj} · {r.docs.length} ficha(s) · 1ª em {ymLabel(r.firstKey)} · ciência {r.acked}/{r.docs.length}</p>
                      </div>
                      <div className="text-sm text-right"><p className="text-xs text-muted-foreground">Antes{r.baselineKey ? ` (${ymLabel(r.baselineKey)})` : ""}</p><p>{r.baseline != null ? brl(r.baseline) : "—"}</p></div>
                      <div className="text-sm text-right"><p className="text-xs text-muted-foreground">Após</p><p>{r.lastAfter != null ? brl(r.lastAfter) : "—"}</p></div>
                      <div className="text-sm text-right w-24"><p className="text-xs text-muted-foreground">Diferença</p><p className={r.diff && r.diff > 0 ? "text-primary font-medium" : r.diff && r.diff < 0 ? "text-destructive font-medium" : ""}>{r.diff != null ? brl(r.diff) : "—"}</p></div>
                      <Badge variant={S.variant} className="gap-1"><S.icon className="h-3 w-3" />{S.label}</Badge>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t p-3 grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium mb-2">Mensalidade Sindical por competência</p>
                        <Table><TableHeader><TableRow><TableHead>Competência</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {r.baselineKey && <TableRow><TableCell>{ymLabel(r.baselineKey)} <span className="text-xs text-muted-foreground">(antes)</span></TableCell><TableCell className="text-right">{brl(r.baseline!)}</TableCell></TableRow>}
                            {r.after.map((a) => <TableRow key={a.key}><TableCell>{ymLabel(a.key)}</TableCell><TableCell className="text-right">{a.value ? brl(a.value) : "Aguardando valor"}</TableCell></TableRow>)}
                            {!r.after.length && <TableRow><TableCell colSpan={2} className="text-muted-foreground">Nenhum boleto após a ficha</TableCell></TableRow>}
                          </TableBody></Table>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">Fichas enviadas</p>
                        <Table><TableHeader><TableRow><TableHead>Trabalhador</TableHead><TableHead>Envio</TableHead><TableHead>Ciência</TableHead></TableRow></TableHeader>
                          <TableBody>{r.docs.map((d, i) => {
                            const dt = d.made_available_at || d.approved_at;
                            return <TableRow key={i}><TableCell>{d.worker_name || "—"}</TableCell>
                              <TableCell>{dt ? new Date(dt).toLocaleDateString("pt-BR") : "—"}</TableCell>
                              <TableCell><Badge variant={d.ack_status === "confirmed" ? "default" : "outline"}>{d.ack_status === "confirmed" ? "Confirmada" : "Pendente"}</Badge></TableCell></TableRow>;
                          })}</TableBody></Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
