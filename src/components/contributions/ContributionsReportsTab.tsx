import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  FileSpreadsheet,
  Building2,
  Calendar,
  TrendingUp,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
}

interface ContributionType {
  id: string;
  name: string;
}

interface Contribution {
  id: string;
  employer_id: string;
  contribution_type_id: string;
  competence_month: number;
  competence_year: number;
  value: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  paid_value: number | null;
  employers?: Employer;
  contribution_types?: ContributionType;
}

interface ContributionsReportsTabProps {
  contributions: Contribution[];
  employers: Employer[];
  contributionTypes: ContributionType[];
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function ContributionsReportsTab({
  contributions,
  employers,
  contributionTypes,
}: ContributionsReportsTabProps) {
  const [reportType, setReportType] = useState<string>("by-employer");
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("hide_cancelled");

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const filteredContributions = useMemo(() => {
    return contributions.filter((c) => {
      const matchesYear = c.competence_year === yearFilter;
      const matchesMonth = monthFilter === "all" || c.competence_month === parseInt(monthFilter);
      const matchesStatus = statusFilter === "all" || (statusFilter === "hide_cancelled" ? c.status !== "cancelled" : c.status === statusFilter);
      return matchesYear && matchesMonth && matchesStatus;
    });
  }, [contributions, yearFilter, monthFilter, statusFilter]);

  // Report by employer
  const byEmployerReport = useMemo(() => {
    const data = new Map<string, {
      employer: Employer;
      total: number;
      paid: number;
      pending: number;
      overdue: number;
      count: number;
    }>();

    filteredContributions.forEach((c) => {
      if (!c.employers) return;
      
      const existing = data.get(c.employer_id) || {
        employer: c.employers,
        total: 0,
        paid: 0,
        pending: 0,
        overdue: 0,
        count: 0,
      };

      existing.total += c.value;
      existing.count += 1;
      
      if (c.status === "paid") {
        existing.paid += c.paid_value || c.value;
      } else if (c.status === "pending") {
        existing.pending += c.value;
      } else if (c.status === "overdue") {
        existing.overdue += c.value;
      }

      data.set(c.employer_id, existing);
    });

    return Array.from(data.values()).sort((a, b) => b.total - a.total);
  }, [filteredContributions]);

  // Report by month
  const byMonthReport = useMemo(() => {
    return MONTHS.map((month, index) => {
      const monthContribs = filteredContributions.filter(
        (c) => c.competence_month === index + 1
      );

      const total = monthContribs.reduce((acc, c) => acc + c.value, 0);
      const paid = monthContribs
        .filter((c) => c.status === "paid")
        .reduce((acc, c) => acc + (c.paid_value || c.value), 0);
      const pending = monthContribs
        .filter((c) => c.status === "pending" || c.status === "overdue")
        .reduce((acc, c) => acc + c.value, 0);

      return {
        month,
        monthIndex: index + 1,
        count: monthContribs.length,
        total,
        paid,
        pending,
      };
    }).filter((m) => m.count > 0);
  }, [filteredContributions]);

  // Report by type
  const byTypeReport = useMemo(() => {
    const data = new Map<string, {
      type: ContributionType;
      total: number;
      paid: number;
      count: number;
    }>();

    filteredContributions.forEach((c) => {
      if (!c.contribution_types) return;
      
      const existing = data.get(c.contribution_type_id) || {
        type: c.contribution_types,
        total: 0,
        paid: 0,
        count: 0,
      };

      existing.total += c.value;
      existing.count += 1;
      
      if (c.status === "paid") {
        existing.paid += c.paid_value || c.value;
      }

      data.set(c.contribution_type_id, existing);
    });

    return Array.from(data.values()).sort((a, b) => b.total - a.total);
  }, [filteredContributions]);

  // Summary totals
  const summary = useMemo(() => {
    const total = filteredContributions.reduce((acc, c) => acc + c.value, 0);
    const paid = filteredContributions
      .filter((c) => c.status === "paid")
      .reduce((acc, c) => acc + (c.paid_value || c.value), 0);
    const pending = filteredContributions
      .filter((c) => c.status === "pending")
      .reduce((acc, c) => acc + c.value, 0);
    const overdue = filteredContributions
      .filter((c) => c.status === "overdue")
      .reduce((acc, c) => acc + c.value, 0);

    return { total, paid, pending, overdue, count: filteredContributions.length };
  }, [filteredContributions]);

  const handleExportCSV = () => {
    let csvContent = "";
    let filename = "";

    if (reportType === "by-employer") {
      csvContent = "Empresa,CNPJ,Qtd,Total,Pago,Pendente,Vencido\n";
      byEmployerReport.forEach((row) => {
        csvContent += `"${row.employer.name}","${row.employer.cnpj}",${row.count},${row.total / 100},${row.paid / 100},${row.pending / 100},${row.overdue / 100}\n`;
      });
      filename = `contribuicoes-por-empresa-${yearFilter}.csv`;
    } else if (reportType === "by-month") {
      csvContent = "Mês,Qtd,Total,Pago,Pendente\n";
      byMonthReport.forEach((row) => {
        csvContent += `"${row.month}",${row.count},${row.total / 100},${row.paid / 100},${row.pending / 100}\n`;
      });
      filename = `contribuicoes-por-mes-${yearFilter}.csv`;
    } else {
      csvContent = "Tipo,Qtd,Total,Pago\n";
      byTypeReport.forEach((row) => {
        csvContent += `"${row.type.name}",${row.count},${row.total / 100},${row.paid / 100}\n`;
      });
      filename = `contribuicoes-por-tipo-${yearFilter}.csv`;
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros do Relatório
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo de relatório" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="by-employer">Por Empresa</SelectItem>
                <SelectItem value="by-month">Por Mês</SelectItem>
                <SelectItem value="by-type">Por Tipo</SelectItem>
              </SelectContent>
            </Select>

            <Select value={String(yearFilter)} onValueChange={(v) => setYearFilter(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map((year) => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {MONTHS.map((month, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hide_cancelled">Ocultar cancelados</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="overdue">Vencidos</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={handleExportCSV} className="ml-auto">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Geral</p>
            <p className="text-xl font-bold">{formatCurrency(summary.total)}</p>
            <p className="text-xs text-muted-foreground">{summary.count} contribuições</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Recebido</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(summary.paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(summary.pending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Vencido</p>
            <p className="text-xl font-bold text-rose-600">{formatCurrency(summary.overdue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Report Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            {reportType === "by-employer" && "Relatório por Empresa"}
            {reportType === "by-month" && "Relatório por Mês"}
            {reportType === "by-type" && "Relatório por Tipo"}
          </CardTitle>
          <CardDescription>
            {filteredContributions.length} contribuições no período selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {reportType === "by-employer" && (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead className="text-right">Pendente</TableHead>
                    <TableHead className="text-right">Vencido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byEmployerReport.length > 0 ? (
                    byEmployerReport.map((row) => (
                      <TableRow key={row.employer.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{row.employer.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.employer.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{row.count}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(row.total)}</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatCurrency(row.paid)}</TableCell>
                        <TableCell className="text-right text-amber-600">{formatCurrency(row.pending)}</TableCell>
                        <TableCell className="text-right text-rose-600">{formatCurrency(row.overdue)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum dado encontrado para o período selecionado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {reportType === "by-month" && (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead className="text-right">Pendente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byMonthReport.length > 0 ? (
                    byMonthReport.map((row) => (
                      <TableRow key={row.monthIndex}>
                        <TableCell className="font-medium">{row.month}/{yearFilter}</TableCell>
                        <TableCell className="text-center">{row.count}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(row.total)}</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatCurrency(row.paid)}</TableCell>
                        <TableCell className="text-right text-amber-600">{formatCurrency(row.pending)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum dado encontrado para o período selecionado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {reportType === "by-type" && (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Tipo de Contribuição</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead className="text-right">% do Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byTypeReport.length > 0 ? (
                    byTypeReport.map((row) => {
                      const percentage = summary.total > 0 
                        ? Math.round((row.total / summary.total) * 100) 
                        : 0;
                      
                      return (
                        <TableRow key={row.type.id}>
                          <TableCell className="font-medium">{row.type.name}</TableCell>
                          <TableCell className="text-center">{row.count}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(row.total)}</TableCell>
                          <TableCell className="text-right text-emerald-600">{formatCurrency(row.paid)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{percentage}%</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum dado encontrado para o período selecionado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
