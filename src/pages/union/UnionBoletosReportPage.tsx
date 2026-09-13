import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { FileBarChart, FileDown, Printer, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
import {
  BoletosReportFilters,
  BoletosReportFiltersState,
  defaultBoletosReportFilters,
} from "@/components/union/reports/BoletosReportFilters";
import {
  BoletosPrintConfigDialog,
  BoletosPrintConfig,
  defaultBoletosPrintConfig,
} from "@/components/union/reports/BoletosPrintConfigDialog";
import {
  buildBoletosReportPdf,
  exportBoletosReportToExcel,
  sortBoletosRows,
  type BoletoReportRow,
  type BoletosReportTotals,
} from "@/lib/boletosReportPdfUtils";

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Pago", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  overdue: { label: "Vencido", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

interface RawRow {
  id: string;
  value: number;
  due_date: string | null;
  status: string;
  competence_month: number;
  competence_year: number;
  paid_at: string | null;
  paid_value: number | null;
  created_at: string;
  member_id: string | null;
  employers: { id: string; name: string; cnpj: string | null } | null;
  contribution_types: { name: string } | null;
}

const PAGE_SIZE = 50;

export default function UnionBoletosReportPage() {
  const { currentClinic, userRoles } = useAuth();
  const resolvedClinic = useMemo(
    () => userRoles.find((r) => r.clinic_id === SINDICATO_CLINIC_ID)?.clinic || currentClinic,
    [currentClinic, userRoles]
  );
  const clinicId = resolvedClinic?.id;
  const clinicName = resolvedClinic?.name || "Entidade Sindical";

  const [filters, setFilters] = useState<BoletosReportFiltersState>(defaultBoletosReportFilters);
  const [page, setPage] = useState(1);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["union-boletos-report", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const rows: RawRow[] = [];
      const pageSize = 1000;
      for (let p = 0; p < 50; p++) {
        const { data: chunk, error } = await supabase
          .from("employer_contributions")
          .select(
            "id, value, due_date, status, competence_month, competence_year, paid_at, paid_value, created_at, member_id, employers(id, name, cnpj), contribution_types(name)"
          )
          .eq("clinic_id", clinicId!)
          .order("due_date", { ascending: false })
          .order("id", { ascending: true })
          .range(p * pageSize, p * pageSize + pageSize - 1);
        if (error) throw error;
        rows.push(...((chunk || []) as unknown as RawRow[]));
        if (!chunk || chunk.length < pageSize) break;
      }
      return rows;
    },
  });

  const memberIds = useMemo(() => {
    const ids = new Set<string>();
    (data || []).forEach((r) => r.member_id && ids.add(r.member_id));
    return Array.from(ids);
  }, [data]);

  const { data: membersMap } = useQuery({
    queryKey: ["union-boletos-report-members", memberIds.join(",")],
    enabled: memberIds.length > 0,
    queryFn: async () => {
      const map: Record<string, { name: string; cpf: string | null }> = {};
      const chunkSize = 500;
      for (let i = 0; i < memberIds.length; i += chunkSize) {
        const chunk = memberIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("patients")
          .select("id, name, cpf")
          .in("id", chunk);
        if (error) throw error;
        (data || []).forEach((p: any) => {
          map[p.id] = { name: p.name, cpf: p.cpf };
        });
      }
      return map;
    },
  });

  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>();
    (data || []).forEach((r) => r.competence_year && set.add(r.competence_year));
    return Array.from(set).sort((a, b) => b - a);
  }, [data]);

  const enrichedRows: BoletoReportRow[] = useMemo(() => {
    return (data || []).map((r) => {
      const member = r.member_id ? membersMap?.[r.member_id] : undefined;
      const associado = member?.name || r.employers?.name || "—";
      const cpfCnpj = member?.cpf || r.employers?.cnpj || "—";
      return {
        id: r.id,
        associado,
        cpfCnpj,
        competencia: `${String(r.competence_month).padStart(2, "0")}/${r.competence_year}`,
        vencimento: r.due_date,
        valor: r.value || 0,
        valorPago: r.paid_value,
        dataPagamento: r.paid_at,
        status: r.status,
        statusLabel: STATUS_LABEL[r.status]?.label || r.status,
      };
    });
  }, [data, membersMap]);

  const today = format(new Date(), "yyyy-MM-dd");

  const filteredRows = useMemo(() => {
    const term = filters.associadoOuEmpresa.trim().toLowerCase();
    const cpfDigits = filters.cpfCnpj.replace(/\D/g, "");
    const valorMinCents = filters.valorMin ? Math.round(parseFloat(filters.valorMin) * 100) : null;
    const valorMaxCents = filters.valorMax ? Math.round(parseFloat(filters.valorMax) * 100) : null;

    return enrichedRows.filter((r) => {
      // período (vencimento ou geração) - usamos vencimento por padrão já que
      // criação não está no enriquecido; vencimento é o campo relevante para filtro de período
      if (filters.periodoBase === "vencimento") {
        if (filters.dataInicio && (!r.vencimento || r.vencimento < filters.dataInicio)) return false;
        if (filters.dataFim && (!r.vencimento || r.vencimento > filters.dataFim)) return false;
      }

      if (filters.dataPagamentoInicio) {
        if (!r.dataPagamento || r.dataPagamento.slice(0, 10) < filters.dataPagamentoInicio) return false;
      }
      if (filters.dataPagamentoFim) {
        if (!r.dataPagamento || r.dataPagamento.slice(0, 10) > filters.dataPagamentoFim) return false;
      }

      if (filters.competenciaMes || filters.competenciaAno) {
        const [mesStr, anoStr] = r.competencia.split("/");
        if (filters.competenciaMes && mesStr !== filters.competenciaMes.padStart(2, "0")) return false;
        if (filters.competenciaAno && anoStr !== filters.competenciaAno) return false;
      }

      if (filters.status.length > 0 && !filters.status.includes(r.status as any)) return false;

      if (term) {
        if (!r.associado.toLowerCase().includes(term)) return false;
      }
      if (cpfDigits) {
        if (!(r.cpfCnpj || "").replace(/\D/g, "").includes(cpfDigits)) return false;
      }

      if (valorMinCents != null && r.valor < valorMinCents) return false;
      if (valorMaxCents != null && r.valor > valorMaxCents) return false;

      if (filters.pagoNaoPago === "paid" && r.status !== "paid") return false;
      if (filters.pagoNaoPago === "unpaid" && r.status === "paid") return false;

      const isOverdue = r.status === "overdue" || (r.status === "pending" && !!r.vencimento && r.vencimento < today);
      if (filters.vencidoNaoVencido === "overdue" && !isOverdue) return false;
      if (filters.vencidoNaoVencido === "not_overdue" && isOverdue) return false;

      return true;
    });
  }, [enrichedRows, filters, today]);

  const totals: BoletosReportTotals = useMemo(() => {
    const previsto = filteredRows.reduce((s, r) => s + r.valor, 0);
    const pago = filteredRows.filter((r) => r.status === "paid").reduce((s, r) => s + (r.valorPago ?? r.valor), 0);
    const aReceber = filteredRows
      .filter((r) => r.status === "pending" || r.status === "overdue")
      .reduce((s, r) => s + r.valor, 0);
    const vencidoValor = filteredRows.filter((r) => r.status === "overdue").reduce((s, r) => s + r.valor, 0);

    return {
      previsto,
      pago,
      aReceber,
      qtdPagos: filteredRows.filter((r) => r.status === "paid").length,
      qtdPendentes: filteredRows.filter((r) => r.status === "pending").length,
      qtdVencidos: filteredRows.filter((r) => r.status === "overdue").length,
      qtdCancelados: filteredRows.filter((r) => r.status === "cancelled").length,
      percentualRecebimento: previsto > 0 ? (pago / previsto) * 100 : 0,
      percentualInadimplencia: previsto > 0 ? (vencidoValor / previsto) * 100 : 0,
    };
  }, [filteredRows]);

  const filtrosAplicadosTexto = useMemo(() => {
    const items: string[] = [];
    if (filters.dataInicio) items.push(`Vencimento de ${format(parseDateOnlyToLocalNoon(filters.dataInicio), "dd/MM/yyyy")}`);
    if (filters.dataFim) items.push(`até ${format(parseDateOnlyToLocalNoon(filters.dataFim), "dd/MM/yyyy")}`);
    if (filters.dataPagamentoInicio) items.push(`Pagamento de ${format(parseDateOnlyToLocalNoon(filters.dataPagamentoInicio), "dd/MM/yyyy")}`);
    if (filters.dataPagamentoFim) items.push(`até ${format(parseDateOnlyToLocalNoon(filters.dataPagamentoFim), "dd/MM/yyyy")}`);
    if (filters.competenciaMes) items.push(`Mês ${filters.competenciaMes}`);
    if (filters.competenciaAno) items.push(`Ano ${filters.competenciaAno}`);
    if (filters.status.length) items.push(`Status: ${filters.status.join(", ")}`);
    if (filters.associadoOuEmpresa) items.push(`Associado/Empresa: ${filters.associadoOuEmpresa}`);
    if (filters.cpfCnpj) items.push(`CPF/CNPJ: ${filters.cpfCnpj}`);
    if (filters.valorMin) items.push(`Valor mín: R$ ${filters.valorMin}`);
    if (filters.valorMax) items.push(`Valor máx: R$ ${filters.valorMax}`);
    if (filters.pagoNaoPago !== "all") items.push(filters.pagoNaoPago === "paid" ? "Somente pagos" : "Somente não pagos");
    if (filters.vencidoNaoVencido !== "all") items.push(filters.vencidoNaoVencido === "overdue" ? "Somente vencidos" : "Somente não vencidos");
    return items;
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortBoletosRows(filteredRows, "vencimento").slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const handleFiltersChange = (f: BoletosReportFiltersState) => {
    setFilters(f);
    setPage(1);
  };

  const handlePrintConfirm = (config: BoletosPrintConfig) => {
    if (!filteredRows.length) {
      toast.error("Nenhum registro para gerar o relatório");
      return;
    }
    buildBoletosReportPdf({
      rows: filteredRows,
      totals,
      clinicName,
      filtrosAplicados: filtrosAplicadosTexto,
      config,
    });
  };

  const handleExportPdfDireto = () => {
    if (!filteredRows.length) {
      toast.error("Nenhum registro para exportar");
      return;
    }
    buildBoletosReportPdf({
      rows: filteredRows,
      totals,
      clinicName,
      filtrosAplicados: filtrosAplicadosTexto,
      config: defaultBoletosPrintConfig,
    });
  };

  const handleExportExcel = () => {
    if (!filteredRows.length) {
      toast.error("Nenhum registro para exportar");
      return;
    }
    exportBoletosReportToExcel({
      rows: filteredRows,
      totals,
      clinicName,
      filtrosAplicados: filtrosAplicadosTexto,
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileBarChart className="h-6 w-6 text-primary" />
            Relatório de Boletos
          </h1>
          <p className="text-muted-foreground text-sm">
            Visão completa de boletos de sócios e empresas, com filtros, indicadores e exportação.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setPrintDialogOpen(true)}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir Relatório
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdfDireto}>
            <FileDown className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <BoletosReportFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        anosDisponiveis={anosDisponiveis}
      />

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Valor Previsto</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(totals.previsto)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Valor Recebido</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(totals.pago)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Valor a Receber</p>
              <p className="text-lg font-bold text-amber-600">{formatCurrency(totals.aReceber)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">% Recebimento</p>
              <p className="text-lg font-bold text-foreground">{totals.percentualRecebimento.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">% Inadimplência</p>
              <p className="text-lg font-bold text-destructive">{totals.percentualInadimplencia.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Pagos / Pend. / Venc. / Canc.</p>
              <p className="text-sm font-bold text-foreground">
                {totals.qtdPagos} / {totals.qtdPendentes} / {totals.qtdVencidos} / {totals.qtdCancelados}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Associado / Empresa</TableHead>
                  <TableHead>CPF / CNPJ</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Valor Pago</TableHead>
                  <TableHead>Data Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : pagedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhum boleto encontrado com os filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.associado}</TableCell>
                      <TableCell>{r.cpfCnpj}</TableCell>
                      <TableCell>{r.competencia}</TableCell>
                      <TableCell>
                        {r.vencimento ? format(parseDateOnlyToLocalNoon(r.vencimento), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(r.valor)}</TableCell>
                      <TableCell className="text-right">
                        {r.valorPago != null ? formatCurrency(r.valorPago) : "—"}
                      </TableCell>
                      <TableCell>
                        {r.dataPagamento ? format(new Date(r.dataPagamento), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_LABEL[r.status]?.variant || "outline"}>
                          {r.statusLabel}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!isLoading && filteredRows.length > 0 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-muted-foreground">
                {filteredRows.length} registro(s) — página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <BoletosPrintConfigDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        onConfirm={handlePrintConfirm}
      />
    </div>
  );
}
