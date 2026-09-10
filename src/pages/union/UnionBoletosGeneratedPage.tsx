import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Barcode, ExternalLink, FileDown, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
import { getLytexTitleNumber } from "@/components/employers/EmployerContributionsTab";

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (cents || 0) / 100
  );

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Pago", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  overdue: { label: "Vencido", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "outline" },
  awaiting_value: { label: "Aguardando valor", variant: "outline" },
};

interface BoletoRow {
  id: string;
  value: number;
  due_date: string;
  created_at: string;
  status: string;
  lytex_invoice_id: string | null;
  lytex_invoice_url: string | null;
  lytex_raw_data: any;
  competence_month: number;
  competence_year: number;
  employers: { name: string; cnpj: string | null } | null;
  contribution_types: { name: string } | null;
}

export default function UnionBoletosGeneratedPage() {
  const { currentClinic, userRoles } = useAuth();
  const resolvedClinic = useMemo(
    () =>
      userRoles.find((r) => r.clinic_id === SINDICATO_CLINIC_ID)?.clinic || currentClinic,
    [currentClinic, userRoles]
  );
  const clinicId = resolvedClinic?.id;

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [hasSearched, setHasSearched] = useState(false);
  const [appliedRange, setAppliedRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["union-lytex-boletos", clinicId, appliedRange.start, appliedRange.end],
    enabled: !!clinicId && hasSearched,
    queryFn: async () => {
      const rows: BoletoRow[] = [];
      const pageSize = 1000;
      for (let page = 0; page < 20; page++) {
        let q = supabase
          .from("employer_contributions")
          .select(
            "id, value, due_date, created_at, status, lytex_invoice_id, lytex_invoice_url, lytex_raw_data, competence_month, competence_year, employers(name, cnpj), contribution_types(name)"
          )
          .eq("clinic_id", clinicId!)
          .not("lytex_invoice_id", "is", null)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(page * pageSize, page * pageSize + pageSize - 1);

        if (appliedRange.start) q = q.gte("created_at", `${appliedRange.start}T00:00:00`);
        if (appliedRange.end) q = q.lte("created_at", `${appliedRange.end}T23:59:59`);

        const { data: chunk, error } = await q;
        if (error) throw error;
        rows.push(...((chunk || []) as unknown as BoletoRow[]));
        if (!chunk || chunk.length < pageSize) break;
      }
      return rows;
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    return (data || []).filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!term) return true;
      const titleNumber = getLytexTitleNumber(r) || "";
      return (
        (r.employers?.name || "").toLowerCase().includes(term) ||
        (digits && (r.employers?.cnpj || "").replace(/\D/g, "").includes(digits)) ||
        titleNumber.toLowerCase().includes(term) ||
        (r.lytex_invoice_id || "").toLowerCase().includes(term)
      );
    });
  }, [data, search, statusFilter]);

  const totals = useMemo(() => {
    const sum = (s?: string) =>
      filtered
        .filter((r) => (s ? r.status === s : true))
        .reduce((acc, r) => acc + (r.value || 0), 0);
    return {
      count: filtered.length,
      total: sum(),
      paid: sum("paid"),
      pending: sum("pending"),
      overdue: sum("overdue"),
    };
  }, [filtered]);

  const syncWithLytex = async (ids: string[]) => {
    if (!clinicId || ids.length === 0) return { updated: 0 };
    const { data: result, error } = await supabase.functions.invoke("lytex-refresh-boletos", {
      body: { clinicId, contributionIds: ids },
    });
    if (error) throw new Error(error.message);
    if (result?.error) throw new Error(result.error);
    return result as { updated: number; unchanged: number; checked: number; errors: string[] };
  };

  const handleSyncAll = async () => {
    if (!filtered.length) {
      toast.error("Nenhum boleto para atualizar");
      return;
    }
    setSyncingAll(true);
    try {
      const ids = filtered.map((r) => r.id);
      // Lytex processa em lotes para não sobrecarregar a API
      const batchSize = 25;
      let totalUpdated = 0;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const result = await syncWithLytex(batch);
        totalUpdated += result.updated || 0;
      }
      toast.success(
        totalUpdated > 0
          ? `${totalUpdated} boleto(s) atualizado(s) com o status real da Lytex`
          : "Boletos já estavam atualizados"
      );
      await refetch();
    } catch (err: any) {
      toast.error(`Erro ao sincronizar com a Lytex: ${err?.message || "erro desconhecido"}`);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleSyncOne = async (id: string) => {
    setSyncingIds((prev) => new Set(prev).add(id));
    try {
      const result = await syncWithLytex([id]);
      if (result.errors?.length) {
        toast.error(`Erro ao consultar a Lytex: ${result.errors[0]}`);
      } else if (result.updated > 0) {
        toast.success("Status e link do boleto atualizados");
      } else {
        toast.info("Boleto já está com o status mais recente");
      }
      await refetch();
    } catch (err: any) {
      toast.error(`Erro ao sincronizar boleto: ${err?.message || "erro desconhecido"}`);
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const exportCsv = () => {
    if (!filtered.length) {
      toast.error("Nenhum boleto para exportar");
      return;
    }
    const header = [
      "Data de geração",
      "Nosso número",
      "Empresa",
      "CNPJ",
      "Tipo",
      "Competência",
      "Vencimento",
      "Valor",
      "Status",
    ];
    const lines = filtered.map((r) =>
      [
        format(new Date(r.created_at), "dd/MM/yyyy HH:mm"),
        getLytexTitleNumber(r) || "",
        r.employers?.name || "",
        r.employers?.cnpj || "",
        r.contribution_types?.name || "",
        `${String(r.competence_month).padStart(2, "0")}/${r.competence_year}`,
        r.due_date ? format(parseDateOnlyToLocalNoon(r.due_date), "dd/MM/yyyy") : "",
        ((r.value || 0) / 100).toFixed(2).replace(".", ","),
        STATUS_LABEL[r.status]?.label || r.status,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";")
    );
    const csv = "\uFEFF" + [header.join(";"), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `boletos-lytex-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Barcode className="h-6 w-6 text-primary" />
            Boletos Gerados (Lytex)
          </h1>
          <p className="text-muted-foreground text-sm">
            Acompanhe data de geração, nosso número, valor e status de cada boleto emitido — sincronizado em tempo real com a Lytex.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={syncingAll || isFetching || !hasSearched || filtered.length === 0}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${syncingAll ? "animate-spin" : ""}`} />
            {syncingAll ? "Sincronizando com a Lytex..." : "Atualizar com a Lytex"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <FileDown className="h-4 w-4 mr-1.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Gerado de</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Gerado até</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="pending">Pendente</option>
              <option value="overdue">Vencido</option>
              <option value="paid">Pago</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Buscar</Label>
            <Input
              placeholder="Empresa, CNPJ ou nosso número"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setAppliedRange({ start: startDate, end: endDate });
                setHasSearched(true);
              }}
              disabled={isFetching}
            >
              <Search className="h-4 w-4 mr-1.5" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Boletos</p>
            <p className="text-xl font-semibold">{totals.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Valor total</p>
            <p className="text-xl font-semibold">{formatCurrency(totals.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Pagos</p>
            <p className="text-xl font-semibold text-emerald-600">{formatCurrency(totals.paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Em aberto (pend. + vencidos)</p>
            <p className="text-xl font-semibold text-amber-600">
              {formatCurrency(totals.pending + totals.overdue)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {!hasSearched ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Defina os filtros e clique em "Buscar" para listar os boletos gerados.
            </p>
          ) : isLoading || isFetching ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhum boleto gerado encontrado com os filtros atuais.
            </p>
          ) : (
            <div className="overflow-auto max-h-[600px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Data de geração</TableHead>
                    <TableHead>Nosso número</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Tipo / Competência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Boleto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const st = STATUS_LABEL[r.status] || { label: r.status, variant: "outline" as const };
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {getLytexTitleNumber(r) || "–"}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="font-medium">{r.employers?.name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.employers?.cnpj || ""}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{r.contribution_types?.name || "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {String(r.competence_month).padStart(2, "0")}/{r.competence_year}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {r.due_date
                            ? format(parseDateOnlyToLocalNoon(r.due_date), "dd/MM/yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(r.value)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {r.lytex_invoice_url ? (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={r.lytex_invoice_url} target="_blank" rel="noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">–</span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Sincronizar status com a Lytex"
                              onClick={() => handleSyncOne(r.id)}
                              disabled={syncingIds.has(r.id)}
                            >
                              {syncingIds.has(r.id) ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
