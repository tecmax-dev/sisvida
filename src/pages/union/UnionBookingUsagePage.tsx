import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CalendarDays, Loader2, RefreshCw, Search, Stethoscope, Users, UserRound, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
import { formatDateBR } from "@/lib/date";

type Appt = { id: string; patient_id: string; dependent_id: string | null; professional_id: string; appointment_date: string; start_time: string; status: string };
type Person = {
  key: string; name: string; kind: "titular" | "dependente"; titularId: string; titularName: string;
  total: number; noShow: number; cancelled: number; byProf: Map<string, number>; appts: Appt[]; last: string;
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendado", confirmed: "Confirmado", completed: "Atendido", arrived: "Chegou", in_progress: "Em atendimento",
  no_show: "Faltou", cancelled: "Cancelado",
};
const isoDaysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString("sv-SE"); };

export default function UnionBookingUsagePage() {
  const [from, setFrom] = useState(isoDaysAgo(90));
  const [to, setTo] = useState(isoDaysAgo(-30));
  const [prof, setProf] = useState("");
  const [search, setSearch] = useState("");
  const [limitProf, setLimitProf] = useState(3);
  const [limitTotal, setLimitTotal] = useState(6);
  const [onlyExcess, setOnlyExcess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [patients, setPatients] = useState(new Map<string, string>());
  const [deps, setDeps] = useState(new Map<string, string>());
  const [profs, setProfs] = useState(new Map<string, string>());
  const [detail, setDetail] = useState<Person | null>(null);

  const load = async () => {
    setLoading(true);
    const all: Appt[] = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await supabase.from("appointments")
        .select("id, patient_id, dependent_id, professional_id, appointment_date, start_time, status")
        .eq("clinic_id", SINDICATO_CLINIC_ID).gte("appointment_date", from).lte("appointment_date", to)
        .neq("status", "blocked").order("appointment_date").order("id").range(i, i + 999);
      if (error || !data?.length) break;
      all.push(...(data as Appt[]));
      if (data.length < 1000) break;
    }
    const chunk = async (table: string, ids: string[]) => {
      const m = new Map<string, string>();
      for (let i = 0; i < ids.length; i += 300) {
        const { data } = await (supabase as any).from(table).select("id, name").in("id", ids.slice(i, i + 300));
        (data ?? []).forEach((r: any) => m.set(r.id, r.name));
      }
      return m;
    };
    const [p, d, pr] = await Promise.all([
      chunk("patients", [...new Set(all.map((a) => a.patient_id))]),
      chunk("patient_dependents", [...new Set(all.map((a) => a.dependent_id).filter(Boolean) as string[])]),
      chunk("professionals", [...new Set(all.map((a) => a.professional_id))]),
    ]);
    setAppts(all); setPatients(p); setDeps(d); setProfs(pr); setLoading(false);
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scoped = useMemo(() => appts.filter((a) => !prof || a.professional_id === prof), [appts, prof]);

  const people = useMemo(() => {
    const m = new Map<string, Person>();
    for (const a of scoped) {
      const key = a.dependent_id ? `d:${a.dependent_id}` : `p:${a.patient_id}`;
      const titularName = patients.get(a.patient_id) ?? "Titular";
      if (!m.has(key)) m.set(key, {
        key, kind: a.dependent_id ? "dependente" : "titular", titularId: a.patient_id, titularName,
        name: a.dependent_id ? deps.get(a.dependent_id) ?? "Dependente" : titularName,
        total: 0, noShow: 0, cancelled: 0, byProf: new Map(), appts: [], last: "",
      });
      const p = m.get(key)!;
      p.appts.push(a);
      if (a.status === "cancelled") { p.cancelled++; continue; }
      p.total++;
      if (a.status === "no_show") p.noShow++;
      p.byProf.set(a.professional_id, (p.byProf.get(a.professional_id) ?? 0) + 1);
      if (a.appointment_date > p.last) p.last = a.appointment_date;
    }
    return [...m.values()].filter((p) => p.total > 0).sort((a, b) => b.total - a.total);
  }, [scoped, patients, deps]);

  const excessOf = (p: Person) => {
    const reasons: string[] = [];
    for (const [pid, n] of p.byProf) if (n > limitProf) reasons.push(`${n}x com ${profs.get(pid) ?? "profissional"}`);
    if (p.total > limitTotal) reasons.push(`${p.total} consultas no período`);
    if (p.noShow >= 2) reasons.push(`${p.noShow} faltas`);
    return reasons;
  };

  const q = search.trim().toLowerCase();
  const visiblePeople = people.filter((p) =>
    (!q || p.name.toLowerCase().includes(q) || p.titularName.toLowerCase().includes(q)) && (!onlyExcess || excessOf(p).length));

  const families = useMemo(() => {
    const m = new Map<string, { titular: string; members: Person[]; total: number }>();
    for (const p of people) {
      if (!m.has(p.titularId)) m.set(p.titularId, { titular: p.titularName, members: [], total: 0 });
      const f = m.get(p.titularId)!; f.members.push(p); f.total += p.total;
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [people]);

  const byProfessional = useMemo(() => {
    const m = new Map<string, { total: number; people: Set<string>; noShow: number; top: Map<string, number> }>();
    for (const a of scoped) {
      if (a.status === "cancelled") continue;
      if (!m.has(a.professional_id)) m.set(a.professional_id, { total: 0, people: new Set(), noShow: 0, top: new Map() });
      const r = m.get(a.professional_id)!; const key = a.dependent_id ? `d:${a.dependent_id}` : `p:${a.patient_id}`;
      r.total++; r.people.add(key); if (a.status === "no_show") r.noShow++;
      r.top.set(key, (r.top.get(key) ?? 0) + 1);
    }
    return [...m.entries()].map(([id, r]) => ({ id, name: profs.get(id) ?? "Profissional", ...r })).sort((a, b) => b.total - a.total);
  }, [scoped, profs]);

  const personName = (key: string) => key.startsWith("d:") ? deps.get(key.slice(2)) ?? "Dependente" : patients.get(key.slice(2)) ?? "Titular";
  const excessCount = people.filter((p) => excessOf(p).length).length;
  const used = scoped.filter((a) => a.status !== "cancelled").length;

  const Stat = ({ icon: Icon, label, value, tone }: any) => (
    <Card><CardContent className="flex items-center gap-3 p-4">
      <div className={`rounded-lg p-2 ${tone}`}><Icon className="h-5 w-5" /></div>
      <div><p className="text-2xl font-bold leading-none">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>
    </CardContent></Card>
  );

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Activity className="h-6 w-6 text-primary" /> Uso dos Agendamentos</h1>
          <p className="text-sm text-muted-foreground">Quem mais usa as consultas, com quais profissionais, e onde há excesso.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Imprimir</Button>
          <Button size="sm" onClick={load} disabled={loading}><RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Aplicar período</Button>
        </div>
      </div>

      <Card className="print:hidden"><CardContent className="flex flex-wrap items-end gap-3 p-4">
        <label className="text-xs text-muted-foreground">De<Input type="date" className="h-9" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs text-muted-foreground">Até<Input type="date" className="h-9" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="text-xs text-muted-foreground">Profissional
          <select value={prof} onChange={(e) => setProf(e.target.value)} className="block h-9 min-w-[200px] rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Todos</option>
            {[...profs.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Excesso: mais de X com o mesmo profissional
          <Input type="number" min={1} className="h-9 w-24" value={limitProf} onChange={(e) => setLimitProf(Math.max(1, +e.target.value || 1))} /></label>
        <label className="text-xs text-muted-foreground">ou mais de X no total
          <Input type="number" min={1} className="h-9 w-24" value={limitTotal} onChange={(e) => setLimitTotal(Math.max(1, +e.target.value || 1))} /></label>
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar titular ou dependente" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </CardContent></Card>

      <p className="hidden text-sm print:block">Período: {formatDateBR(from)} a {formatDateBR(to)}{prof ? ` · ${profs.get(prof)}` : ""}</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={CalendarDays} label="Consultas no período (sem canceladas)" value={used} tone="bg-primary/10 text-primary" />
        <Stat icon={Users} label="Pessoas atendidas" value={people.length} tone="bg-emerald-100 text-emerald-700" />
        <Stat icon={Stethoscope} label="Profissionais procurados" value={byProfessional.length} tone="bg-sky-100 text-sky-700" />
        <Stat icon={AlertTriangle} label="Pessoas com excesso" value={excessCount} tone="bg-destructive/10 text-destructive" />
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <Tabs defaultValue="pessoas">
          <TabsList className="print:hidden">
            <TabsTrigger value="pessoas">Titulares e dependentes</TabsTrigger>
            <TabsTrigger value="familias">Por família</TabsTrigger>
            <TabsTrigger value="profissionais">Por profissional</TabsTrigger>
          </TabsList>

          <TabsContent value="pessoas">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Ranking de uso ({visiblePeople.length})</CardTitle>
                <Button size="sm" variant={onlyExcess ? "destructive" : "outline"} className="print:hidden" onClick={() => setOnlyExcess((v) => !v)}>
                  <AlertTriangle className="mr-1 h-4 w-4" />{onlyExcess ? "Mostrando só excessos" : "Só excessos"}
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="w-10">#</TableHead><TableHead>Nome</TableHead><TableHead>Titular</TableHead>
                    <TableHead className="text-center">Consultas</TableHead><TableHead>Profissionais</TableHead>
                    <TableHead className="text-center">Faltas</TableHead><TableHead>Última</TableHead><TableHead>Alerta</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {visiblePeople.map((p, i) => {
                      const ex = excessOf(p);
                      return (
                        <TableRow key={p.key} className={`cursor-pointer ${ex.length ? "bg-destructive/5" : ""}`} onClick={() => setDetail(p)}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell><div className="font-medium">{p.name}</div>
                            <Badge variant="outline" className="mt-0.5 text-[10px]">{p.kind === "titular" ? "Titular" : "Dependente"}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.kind === "dependente" ? p.titularName : "—"}</TableCell>
                          <TableCell className="text-center text-lg font-bold">{p.total}</TableCell>
                          <TableCell className="text-xs">
                            {[...p.byProf.entries()].sort((a, b) => b[1] - a[1]).map(([pid, n]) => (
                              <div key={pid} className={n > limitProf ? "font-semibold text-destructive" : ""}>{profs.get(pid) ?? "—"}: {n}</div>
                            ))}
                          </TableCell>
                          <TableCell className="text-center">{p.noShow || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{formatDateBR(p.last)}</TableCell>
                          <TableCell>{ex.length ? <div className="space-y-0.5">{ex.map((r) => <Badge key={r} variant="destructive" className="block w-fit text-[10px]">{r}</Badge>)}</div> : <span className="text-xs text-muted-foreground">Normal</span>}</TableCell>
                        </TableRow>
                      );
                    })}
                    {!visiblePeople.length && <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Nenhum registro.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="familias" className="space-y-3">
            {families.filter((f) => !q || f.titular.toLowerCase().includes(q) || f.members.some((m) => m.name.toLowerCase().includes(q))).slice(0, 200).map((f) => (
              <Card key={f.titular + f.total}>
                <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
                  <span className="flex items-center gap-2 font-semibold"><UserRound className="h-4 w-4" />{f.titular}</span>
                  <Badge>{f.total} consulta(s) na família</Badge>
                </div>
                <ul className="divide-y text-sm">
                  {f.members.sort((a, b) => (a.kind === "titular" ? -1 : 1) - (b.kind === "titular" ? -1 : 1) || b.total - a.total).map((m) => (
                    <li key={m.key} className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-2 hover:bg-muted/30" onClick={() => setDetail(m)}>
                      <span className="flex-1">{m.name} <span className="text-xs text-muted-foreground">({m.kind})</span></span>
                      <span className="text-xs text-muted-foreground">{[...m.byProf.entries()].map(([pid, n]) => `${profs.get(pid) ?? "—"}: ${n}`).join(" · ")}</span>
                      <Badge variant={excessOf(m).length ? "destructive" : "secondary"}>{m.total}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="profissionais">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {byProfessional.map((r) => (
                <Card key={r.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-primary" />{r.name}</span>
                      <Badge>{r.total}</Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{r.people.size} pessoa(s) · {r.noShow} falta(s)</p>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">Quem mais agenda:</p>
                    {[...r.top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => (
                      <div key={k} className={`flex justify-between ${n > limitProf ? "font-semibold text-destructive" : ""}`}>
                        <span className="truncate">{personName(k)}{k.startsWith("d:") ? " (dep.)" : ""}</span><span>{n}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{detail?.name} {detail?.kind === "dependente" && <span className="text-sm font-normal text-muted-foreground">— dependente de {detail.titularName}</span>}</DialogTitle></DialogHeader>
          {detail && (<>
            {excessOf(detail).length > 0 && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">Excesso: {excessOf(detail).join(" · ")}</div>}
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Hora</TableHead><TableHead>Profissional</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader>
              <TableBody>
                {[...detail.appts].sort((a, b) => b.appointment_date.localeCompare(a.appointment_date)).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{formatDateBR(a.appointment_date)}</TableCell><TableCell>{a.start_time?.slice(0, 5)}</TableCell>
                    <TableCell>{profs.get(a.professional_id) ?? "—"}</TableCell>
                    <TableCell><Badge variant={a.status === "no_show" || a.status === "cancelled" ? "destructive" : "secondary"}>{STATUS_LABEL[a.status] ?? a.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
