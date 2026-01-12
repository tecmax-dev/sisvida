import { useState, useMemo } from "react";
import { getStaticYearRange } from "@/hooks/useAvailableYears";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Building2,
  Calendar,
  TrendingUp,
  Filter,
  ChevronDown,
  Eye,
  Printer,
  AlertTriangle,
  BarChart3,
  List,
  FileSearch,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EmployerSearchCombobox } from "./EmployerSearchCombobox";
import { generateContributionsReport } from "@/lib/contributions-report-pdf";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name?: string | null;
  registration_number?: string | null;
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
  payment_method?: string | null;
  origin?: string;
  lytex_fee_amount?: number | null;
  net_value?: number | null;
  is_reconciled?: boolean;
  has_divergence?: boolean;
  lytex_invoice_id?: string | null;
  employers?: Employer;
  contribution_types?: ContributionType;
}

interface ContributionsReportsTabProps {
  contributions: Contribution[];
  employers: Employer[];
  contributionTypes: ContributionType[];
  clinicName?: string;
  clinicLogo?: string;
  yearFilter: number;
  onYearFilterChange: (year: number) => void;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

type ReportType = 'general' | 'by-employer' | 'synthetic' | 'analytical' | 'defaulting';

const REPORT_TYPES: { value: ReportType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'general', label: 'Relatório Geral', icon: <BarChart3 className="h-4 w-4" />, description: 'Visão consolidada de todas as empresas' },
  { value: 'by-employer', label: 'Por Empresa', icon: <Building2 className="h-4 w-4" />, description: 'Detalhado por empresa selecionada' },
  { value: 'synthetic', label: 'Sintético', icon: <TrendingUp className="h-4 w-4" />, description: 'Apenas totais consolidados' },
  { value: 'analytical', label: 'Analítico', icon: <List className="h-4 w-4" />, description: 'Listagem completa para auditoria' },
  { value: 'defaulting', label: 'Inadimplência', icon: <AlertTriangle className="h-4 w-4" />, description: 'Apenas pendentes e vencidos' },
];

export default function ContributionsReportsTab({
  contributions,
  employers,
  contributionTypes,
  clinicName,
  clinicLogo,
  yearFilter,
  onYearFilterChange,
}: ContributionsReportsTabProps) {
  const { session } = useAuth();
  const [reportType, setReportType] = useState<ReportType>("general");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("hide_cancelled");
  const [selectedEmployer, setSelectedEmployer] = useState<Employer | null>(null);
  const [contributionTypeFilter, setContributionTypeFilter] = useState<string>("all");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [dateFilterType, setDateFilterType] = useState<"competence" | "due_date" | "paid_at">("competence");

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return "-";
    const cleaned = cnpj.replace(/\D/g, "");
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const filteredContributions = useMemo(() => {
    return contributions.filter((c) => {
      // Filtro por período baseado no tipo selecionado
      let matchesPeriod = false;
      if (dateFilterType === "competence") {
        matchesPeriod = c.competence_year === yearFilter && 
          (monthFilter === "all" || c.competence_month === parseInt(monthFilter));
      } else if (dateFilterType === "due_date") {
        const dueDate = new Date(c.due_date + "T12:00:00");
        matchesPeriod = dueDate.getFullYear() === yearFilter && 
          (monthFilter === "all" || (dueDate.getMonth() + 1) === parseInt(monthFilter));
      } else if (dateFilterType === "paid_at") {
        if (!c.paid_at) return false; // Se filtro é por data de pagamento, excluir não pagos
        const paidDate = new Date(c.paid_at);
        matchesPeriod = paidDate.getFullYear() === yearFilter && 
          (monthFilter === "all" || (paidDate.getMonth() + 1) === parseInt(monthFilter));
      }
      
      const matchesStatus = statusFilter === "all" || (statusFilter === "hide_cancelled" ? c.status !== "cancelled" : c.status === statusFilter);
      const matchesEmployer = !selectedEmployer || c.employer_id === selectedEmployer.id;
      const matchesType = contributionTypeFilter === "all" || c.contribution_type_id === contributionTypeFilter;
      const matchesOrigin = originFilter === "all" || c.origin === originFilter;
      return matchesPeriod && matchesStatus && matchesEmployer && matchesType && matchesOrigin;
    });
  }, [contributions, yearFilter, monthFilter, statusFilter, selectedEmployer, contributionTypeFilter, originFilter, dateFilterType]);

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

  // Summary totals with fees
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
    
    // Novos totais: taxas e valor líquido
    const totalFees = filteredContributions.reduce((acc, c) => acc + (c.lytex_fee_amount || 0), 0);
    const totalNet = filteredContributions
      .filter((c) => c.status === "paid")
      .reduce((acc, c) => acc + (c.net_value || c.paid_value || c.value), 0);

    return { total, paid, pending, overdue, count: filteredContributions.length, totalFees, totalNet };
  }, [filteredContributions]);

  const periodLabel = useMemo(() => {
    const monthLabel = monthFilter === "all" ? "Todos os meses" : MONTHS[parseInt(monthFilter) - 1];
    return `${monthLabel} de ${yearFilter}`;
  }, [yearFilter, monthFilter]);

  const handleExportCSV = () => {
    let csvContent = "";
    let filename = "";

    csvContent = "Empresa,CNPJ,Qtd,Total,Pago,Pendente,Vencido\n";
    byEmployerReport.forEach((row) => {
      csvContent += `"${row.employer.name}","${row.employer.cnpj}",${row.count},${row.total / 100},${row.paid / 100},${row.pending / 100},${row.overdue / 100}\n`;
    });
    filename = `contribuicoes-${yearFilter}${monthFilter !== "all" ? `-${monthFilter.padStart(2, "0")}` : ""}.csv`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    toast.success("CSV exportado com sucesso!");
  };

  const handleExportPDF = async () => {
    if (filteredContributions.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    const reportData = {
      contributions: filteredContributions,
      summary,
      byEmployerReport,
    };

    const selectedTypeName = contributionTypeFilter !== "all" 
      ? contributionTypes.find(t => t.id === contributionTypeFilter)?.name 
      : undefined;

    const config = {
      clinicName: clinicName || "Sistema de Contribuições",
      clinicLogo: clinicLogo,
      userName: session?.user?.email || "Usuário",
      period: periodLabel,
      selectedEmployer: selectedEmployer,
      contributionTypeName: selectedTypeName,
    };

    try {
      await generateContributionsReport(reportType, reportData, config);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  const currentReportType = REPORT_TYPES.find(r => r.value === reportType);

  return (
    <div className="space-y-6">
      {/* Search and Filters Card */}
      <Card className="border-2 border-amber-200 bg-gradient-to-r from-amber-50/50 to-background">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-amber-600" />
            Filtros do Relatório
          </CardTitle>
          <CardDescription>
            Selecione os filtros para gerar o relatório desejado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Employer Search - Prominent */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <EmployerSearchCombobox
                employers={employers}
                value={selectedEmployer?.id || null}
                onSelect={setSelectedEmployer}
                placeholder="Buscar empresa (Razão Social, Nome Fantasia, CNPJ)..."
              />
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Report Type Selector */}
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {currentReportType?.icon}
                    <span>{currentReportType?.label}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      {type.icon}
                      <div className="flex flex-col">
                        <span className="font-medium">{type.label}</span>
                        <span className="text-xs text-muted-foreground">{type.description}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Filter Type */}
            <Select value={dateFilterType} onValueChange={(v) => setDateFilterType(v as "competence" | "due_date" | "paid_at")}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="competence">Por Competência</SelectItem>
                <SelectItem value="due_date">Por Vencimento</SelectItem>
                <SelectItem value="paid_at">Por Pagamento</SelectItem>
              </SelectContent>
            </Select>

            <Select value={String(yearFilter)} onValueChange={(v) => onYearFilterChange(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getStaticYearRange().map((year) => (
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
              <SelectTrigger className="w-[160px]">
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

            {/* Contribution Type Filter */}
            <Select value={contributionTypeFilter} onValueChange={setContributionTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo de Contribuição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {contributionTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Origin Filter */}
            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas origens</SelectItem>
                <SelectItem value="lytex">Lytex</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="import">Importação</SelectItem>
              </SelectContent>
            </Select>

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" className="ml-auto gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <Download className="h-4 w-4" />
                  Exportar
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">
                  <FileText className="h-4 w-4 mr-2 text-rose-600" />
                  Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
                  Exportar CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Selected Employer Badge */}
          {selectedEmployer && (
            <div className="flex items-center gap-2 p-2 bg-amber-100 rounded-lg">
              <Building2 className="h-4 w-4 text-amber-700" />
              <span className="text-sm font-medium text-amber-800">
                Filtrando por: {selectedEmployer.name}
              </span>
              <Badge variant="outline" className="font-mono text-xs bg-white">
                {formatCNPJ(selectedEmployer.cnpj)}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-l-4 border-l-slate-600">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Bruto</p>
            <p className="text-xl font-bold">{formatCurrency(summary.total)}</p>
            <p className="text-xs text-muted-foreground">{summary.count} contribuições</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Recebido</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(summary.paid)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Taxas Lytex</p>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(summary.totalFees)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Líquido</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(summary.totalNet)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(summary.pending)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-3">
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
            {currentReportType?.label || "Relatório"}
          </CardTitle>
          <CardDescription>
            {filteredContributions.length} contribuições no período selecionado
            {selectedEmployer && ` • Empresa: ${selectedEmployer.name}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
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
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              {formatCNPJ(row.employer.cnpj)}
                            </span>
                            {row.employer.registration_number && (
                              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                                Mat: {row.employer.registration_number}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{row.count}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(row.total)}</TableCell>
                      <TableCell className="text-right text-emerald-600 font-medium">{formatCurrency(row.paid)}</TableCell>
                      <TableCell className="text-right text-amber-600 font-medium">{formatCurrency(row.pending)}</TableCell>
                      <TableCell className="text-right text-rose-600 font-medium">{formatCurrency(row.overdue)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <FileSearch className="h-8 w-8" />
                        <p>Nenhum dado encontrado para o período selecionado</p>
                        <p className="text-sm">Tente ajustar os filtros acima</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
