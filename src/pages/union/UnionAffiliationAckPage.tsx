import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CalendarDays, CheckCircle2, Clock, Eye, FileSignature, Loader2, RefreshCw, Search, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
import { AffiliationFichaView, fmtDate, printPdf, useFichaPdfUrl } from "@/components/affiliations/AffiliationFichaView";

type Row = {
  id: string; employer_id: string; employer_cnpj: string | null; worker_name: string; worker_cpf: string | null;
  associado_id: string | null; file_path: string | null; title: string; snapshot: any; source: string;
  approved_at: string | null; made_available_at: string; opened_at: string | null;
  ack_status: "pending" | "confirmed"; ack_at: string | null; ack_by_name: string | null; ack_portal_type: string | null;
  classification_notice: boolean;
};

const fmtCnpj = (c?: string | null) => {
  const d = String(c ?? "").replace(/\D/g, "");
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : c ?? "";
};
const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
const monthKey = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

export default function UnionAffiliationAckPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"pending" | "confirmed" | "all">("pending");
  const [groupBy, setGroupBy] = useState<"employer" | "date">("employer");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [viewing, setViewing] = useState<any>(null);
  const { url: pdfUrl } = useFichaPdfUrl(viewing?.pdf_data);
  const printUrl = viewing?.file_url || pdfUrl;

  const load = async () => {
    setLoading(true);
    const all: Row[] = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await (supabase as any).from("affiliation_company_documents")
        .select("id, employer_id, employer_cnpj, worker_name, worker_cpf, associado_id, file_path, title, snapshot, source, approved_at, made_available_at, opened_at, ack_status, ack_at, ack_by_name, ack_portal_type, classification_notice")
        .eq("clinic_id", SINDICATO_CLINIC_ID).order("made_available_at", { ascending: false }).order("id").range(i, i + 999);
      if (error || !data?.length) break;
      all.push(...data);
      if (data.length < 1000) break;
    }
    const ids = [...new Set(all.map((r) => r.employer_id))];
    const map = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase.from("employers").select("id, name, trade_name").in("id", ids.slice(i, i + 200));
      (data ?? []).forEach((e: any) => map.set(e.id, e.trade_name || e.name));
    }
    setNames(map); setRows(all); setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase(); const qd = q.replace(/\D/g, "");
    return rows.filter((r) => {
      if (status !== "all" && r.ack_status !== status) return false;
      const day = r.made_available_at.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (!q) return true;
      return r.worker_name.toLowerCase().includes(q) || (names.get(r.employer_id) ?? "").toLowerCase().includes(q) ||
        (qd.length >= 3 && (String(r.employer_cnpj ?? "").replace(/\D/g, "").includes(qd) || String(r.worker_cpf ?? "").replace(/\D/g, "").includes(qd)));
    });
  }, [rows, status, search, from, to, names]);

  const pendingAll = rows.filter((r) => r.ack_status === "pending");
  const stats = {
    pending: pendingAll.length,
    companies: new Set(pendingAll.map((r) => r.employer_id)).size,
    late: pendingAll.filter((r) => daysSince(r.made_available_at) > 7).length,
    confirmed: rows.length - pendingAll.length,
  };

  const groups = useMemo(() => {
    const g = new Map<string, { title: string; sub?: string; link?: string; items: Row[] }>();
    for (const r of filtered) {
      const key = groupBy === "employer" ? r.employer_id : monthKey(r.made_available_at);
      if (!g.has(key)) g.set(key, groupBy === "employer"
        ? { title: names.get(r.employer_id) ?? "Empresa", sub: fmtCnpj(r.employer_cnpj), link: `/union/empresas/${r.employer_id}`, items: [] }
        : { title: key.charAt(0).toUpperCase() + key.slice(1), items: [] });
      g.get(key)!.items.push(r);
    }
    const arr = [...g.values()];
    if (groupBy === "employer") arr.sort((a, b) => b.items.filter((i) => i.ack_status === "pending").length - a.items.filter((i) => i.ack_status === "pending").length || a.title.localeCompare(b.title));
    return arr;
  }, [filtered, groupBy, names]);

  async function view(d: Row) {
    let fileUrl: string | null = null;
    if (d.file_path) {
      const { data } = await supabase.storage.from("affiliation-documents").createSignedUrl(d.file_path, 3600);
      fileUrl = data?.signedUrl ?? null;
    }
    setViewing({ ...d, file_url: fileUrl, pdf_data: undefined });
    if (!fileUrl && d.associado_id) {
      const { data } = await supabase.functions.invoke("affiliation-documents", { body: { action: "pdf_data", document_id: d.id } });
      setViewing((v: any) => (v?.id === d.id ? { ...v, pdf_data: data?.pdf_data ?? null } : v));
    }
  }

  const StatCard = ({ icon: Icon, label, value, tone }: any) => (
    <Card><CardContent className="flex items-center gap-3 p-4">
      <div className={`rounded-lg p-2 ${tone}`}><Icon className="h-5 w-5" /></div>
      <div><p className="text-2xl font-bold leading-none">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>
    </CardContent></Card>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><FileSignature className="h-6 w-6 text-primary" /> Ciência das Fichas de Filiação</h1>
          <p className="text-sm text-muted-foreground">Acompanhe as fichas enviadas às empresas e quem ainda não confirmou o recebimento.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Clock} label="Fichas aguardando ciência" value={stats.pending} tone="bg-amber-100 text-amber-700" />
        <StatCard icon={Building2} label="Empresas com pendência" value={stats.companies} tone="bg-primary/10 text-primary" />
        <StatCard icon={AlertTriangle} label="Pendentes há mais de 7 dias" value={stats.late} tone="bg-destructive/10 text-destructive" />
        <StatCard icon={CheckCircle2} label="Ciências confirmadas" value={stats.confirmed} tone="bg-emerald-100 text-emerald-700" />
      </div>

      <Card><CardContent className="flex flex-wrap items-end gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar empresa, CNPJ, trabalhador ou CPF" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex rounded-md border p-0.5">
          {([["pending", "Pendentes"], ["confirmed", "Confirmadas"], ["all", "Todas"]] as const).map(([k, l]) => (
            <Button key={k} size="sm" variant={status === k ? "default" : "ghost"} className="h-8" onClick={() => setStatus(k)}>{l}</Button>
          ))}
        </div>
        <div className="flex rounded-md border p-0.5">
          <Button size="sm" variant={groupBy === "employer" ? "default" : "ghost"} className="h-8" onClick={() => setGroupBy("employer")}><Building2 className="mr-1 h-4 w-4" />Por empresa</Button>
          <Button size="sm" variant={groupBy === "date" ? "default" : "ghost"} className="h-8" onClick={() => setGroupBy("date")}><CalendarDays className="mr-1 h-4 w-4" />Por data</Button>
        </div>
        <label className="text-xs text-muted-foreground">De<Input type="date" className="h-9" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs text-muted-foreground">Até<Input type="date" className="h-9" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </CardContent></Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !groups.length ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          {status === "pending" ? "Nenhuma ficha aguardando ciência. Tudo em dia!" : "Nenhuma ficha encontrada com esses filtros."}
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{filtered.length} ficha(s) em {groups.length} grupo(s)</p>
          {groups.map((g) => {
            const pend = g.items.filter((i) => i.ack_status === "pending").length;
            return (
              <Card key={g.title + (g.sub ?? "")} className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
                  <div>
                    {g.link ? <Link to={g.link} className="font-semibold hover:underline">{g.title}</Link> : <span className="font-semibold">{g.title}</span>}
                    {g.sub && <span className="ml-2 text-xs text-muted-foreground">{g.sub}</span>}
                  </div>
                  <div className="flex gap-2">
                    {pend > 0 && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{pend} pendente(s)</Badge>}
                    <Badge variant="outline">{g.items.length} ficha(s)</Badge>
                  </div>
                </div>
                <ul className="divide-y">
                  {g.items.map((r) => {
                    const days = daysSince(r.made_available_at);
                    return (
                      <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{r.worker_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {groupBy === "date" && <>{names.get(r.employer_id) ?? "Empresa"} · </>}
                            Aprovada {fmtDate(r.approved_at)} · enviada {fmtDate(r.made_available_at)}
                            {r.opened_at ? ` · aberta ${fmtDate(r.opened_at)}` : " · ainda não aberta"}
                          </p>
                          {r.classification_notice && <p className="mt-0.5 text-xs text-amber-700">Constava na Taxa Negocial — revisar lista</p>}
                        </div>
                        {r.ack_status === "confirmed" ? (
                          <Badge variant="secondary">Ciência {fmtDate(r.ack_at)} · {r.ack_by_name} ({r.ack_portal_type === "accounting_office" ? "contador" : "empresa"})</Badge>
                        ) : (
                          <Badge variant="outline" className={days > 7 ? "border-destructive text-destructive" : "border-amber-400 text-amber-700"}>
                            Pendente há {days} dia(s)
                          </Badge>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => view(r)}><Eye className="mr-1 h-4 w-4" />Ficha</Button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{viewing?.title} — {viewing?.worker_name}</DialogTitle></DialogHeader>
          {viewing && <AffiliationFichaView snapshot={viewing.snapshot} fileUrl={viewing.file_url} pdfUrl={pdfUrl} pdfLoading={viewing.pdf_data === undefined && !viewing.file_url && !!viewing.associado_id} />}
          <DialogFooter>
            <Button variant="outline" disabled={!printUrl} onClick={() => printUrl && printPdf(printUrl)}>Imprimir</Button>
            {printUrl && <Button variant="outline" asChild><a href={printUrl} download={`ficha-filiacao-${viewing?.worker_name ?? ""}.pdf`}>Baixar PDF</a></Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
