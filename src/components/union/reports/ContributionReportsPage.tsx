import { useState, useMemo, useCallback } from "react";
import { format, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";

import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { generateContributionsReport } from "@/lib/contributions-report-pdf";

import { 
  ContributionReportFilters, 
  ContributionReportFiltersState,
  ReportCategory,
  DateFilterType,
} from "./ContributionReportFilters";
import { ContributionReportMetrics, ReportSummary } from "./ContributionReportMetrics";
import { ContributionReportTable } from "./ContributionReportTable";

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
  created_at?: string;
  updated_at?: string;
}

interface ContributionReportsPageProps {
  contributions: Contribution[];
  employers: Employer[];
  contributionTypes: ContributionType[];
  clinicName?: string;
  clinicLogo?: string;
}

const getDefaultFilters = (): ContributionReportFiltersState => ({
  startDate: startOfYear(new Date()),
  endDate: endOfYear(new Date()),
  selectedEmployer: null,
  status: 'hide_cancelled',
  contributionTypeId: 'all',
  reportCategory: 'by-employer',
  dateFilterType: 'competence',
  originFilter: 'all',
});

export function ContributionReportsPage({
  contributions,
  employers,
  contributionTypes,
  clinicName,
  clinicLogo,
}: ContributionReportsPageProps) {
  const { session } = useAuth();
  const [filters, setFilters] = useState<ContributionReportFiltersState>(getDefaultFilters());
  const [isLoading, setIsLoading] = useState(false);

  // Helper to get date from contribution based on filter type
  const getDateForFilter = useCallback((c: Contribution): Date | null => {
    if (filters.dateFilterType === "competence") {
      return new Date(c.competence_year, c.competence_month - 1, 1);
    } else if (filters.dateFilterType === "due_date") {
      return new Date(c.due_date + "T12:00:00");
    } else if (filters.dateFilterType === "paid_at") {
      if (!c.paid_at) return null;
      return new Date(c.paid_at);
    }
    return null;
  }, [filters.dateFilterType]);

  // Filter contributions
  const filteredContributions = useMemo(() => {
    const start = filters.startDate ? new Date(filters.startDate) : null;
    const end = filters.endDate ? new Date(filters.endDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    
    return contributions.filter((c) => {
      // Date filter
      let matchesPeriod = true;
      const contributionDate = getDateForFilter(c);
      
      if (contributionDate === null && filters.dateFilterType === "paid_at") {
        return false;
      }
      
      if (contributionDate) {
        if (start && contributionDate < start) matchesPeriod = false;
        if (end && contributionDate > end) matchesPeriod = false;
      }
      
      // Status filter
      const matchesStatus = filters.status === "all" || 
        (filters.status === "hide_cancelled" ? c.status !== "cancelled" : c.status === filters.status);
      
      // Employer filter
      const matchesEmployer = !filters.selectedEmployer || c.employer_id === filters.selectedEmployer.id;
      
      // Contribution type filter
      const matchesType = filters.contributionTypeId === "all" || c.contribution_type_id === filters.contributionTypeId;
      
      // Origin filter
      const matchesOrigin = filters.originFilter === "all" || c.origin === filters.originFilter;
      
      return matchesPeriod && matchesStatus && matchesEmployer && matchesType && matchesOrigin;
    });
  }, [contributions, filters, getDateForFilter]);

  // Calculate summary
  const summary: ReportSummary = useMemo(() => {
    const totalValue = filteredContributions.reduce((acc, c) => acc + c.value, 0);
    const paidValue = filteredContributions
      .filter((c) => c.status === "paid")
      .reduce((acc, c) => acc + (c.paid_value || c.value), 0);
    const pendingValue = filteredContributions
      .filter((c) => c.status === "pending")
      .reduce((acc, c) => acc + c.value, 0);
    const overdueValue = filteredContributions
      .filter((c) => c.status === "overdue")
      .reduce((acc, c) => acc + c.value, 0);
    
    const paidCount = filteredContributions.filter((c) => c.status === "paid").length;
    const pendingCount = filteredContributions.filter((c) => c.status === "pending").length;
    const overdueCount = filteredContributions.filter((c) => c.status === "overdue").length;
    
    const employerIds = new Set(filteredContributions.map(c => c.employer_id));
    
    const paymentRate = totalValue > 0 ? (paidValue / totalValue) * 100 : 0;
    const defaultRate = totalValue > 0 ? ((pendingValue + overdueValue) / totalValue) * 100 : 0;

    return {
      totalValue,
      paidValue,
      pendingValue,
      overdueValue,
      totalCount: filteredContributions.length,
      paidCount,
      pendingCount,
      overdueCount,
      employerCount: employerIds.size,
      paymentRate,
      defaultRate,
    };
  }, [filteredContributions]);

  // Generate table data (by employer)
  const tableData = useMemo(() => {
    const employerMap = new Map<string, {
      employerId: string;
      employerName: string;
      cnpj: string;
      totalValue: number;
      paidValue: number;
      pendingValue: number;
      count: number;
      lastUpdate: Date | null;
      hasPaid: boolean;
      hasPending: boolean;
      hasOverdue: boolean;
    }>();

    filteredContributions.forEach((c) => {
      if (!c.employers) return;
      
      const existing = employerMap.get(c.employer_id) || {
        employerId: c.employer_id,
        employerName: c.employers.name,
        cnpj: c.employers.cnpj,
        totalValue: 0,
        paidValue: 0,
        pendingValue: 0,
        count: 0,
        lastUpdate: null,
        hasPaid: false,
        hasPending: false,
        hasOverdue: false,
      };

      existing.totalValue += c.value;
      existing.count += 1;
      
      if (c.status === "paid") {
        existing.paidValue += c.paid_value || c.value;
        existing.hasPaid = true;
      } else if (c.status === "pending") {
        existing.pendingValue += c.value;
        existing.hasPending = true;
      } else if (c.status === "overdue") {
        existing.pendingValue += c.value;
        existing.hasOverdue = true;
      }

      // Track last update
      const updateDate = c.paid_at ? new Date(c.paid_at) : (c.due_date ? new Date(c.due_date + "T12:00:00") : null);
      if (updateDate && (!existing.lastUpdate || updateDate > existing.lastUpdate)) {
        existing.lastUpdate = updateDate;
      }

      employerMap.set(c.employer_id, existing);
    });

    return Array.from(employerMap.values())
      .map(row => ({
        ...row,
        status: row.hasOverdue ? 'overdue' as const : 
                row.hasPending ? (row.hasPaid ? 'mixed' as const : 'pending' as const) : 
                'paid' as const,
      }))
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [filteredContributions]);

  // Export handlers
  const periodLabel = useMemo(() => {
    return `${format(filters.startDate, "dd/MM/yyyy")} a ${format(filters.endDate, "dd/MM/yyyy")}`;
  }, [filters.startDate, filters.endDate]);

  const handleExportPDF = async () => {
    if (filteredContributions.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    setIsLoading(true);
    try {
      const reportData = {
        contributions: filteredContributions,
        summary: {
          total: summary.totalValue,
          paid: summary.paidValue,
          pending: summary.pendingValue,
          overdue: summary.overdueValue,
          count: summary.totalCount,
        },
        byEmployerReport: tableData.map(row => ({
          employer: { 
            id: row.employerId, 
            name: row.employerName, 
            cnpj: row.cnpj,
          },
          total: row.totalValue,
          paid: row.paidValue,
          pending: row.pendingValue,
          overdue: 0,
          count: row.count,
        })),
      };

      const selectedTypeName = filters.contributionTypeId !== 'all' 
        ? contributionTypes.find(t => t.id === filters.contributionTypeId)?.name 
        : undefined;

      const config = {
        clinicName: clinicName || "Sistema de Contribuições",
        clinicLogo: clinicLogo,
        userName: session?.user?.email || "Usuário",
        period: periodLabel,
        selectedEmployer: filters.selectedEmployer ? {
          id: filters.selectedEmployer.id,
          name: filters.selectedEmployer.name,
          cnpj: filters.selectedEmployer.cnpj,
        } : null,
        contributionTypeName: selectedTypeName,
      };

      await generateContributionsReport('general', reportData, config);
      toast.success("Relatório exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar relatório — tente novamente");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (tableData.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    let csvContent = "Empresa,CNPJ,Qtd,Valor Devido,Valor Pago,Saldo Pendente,Situação\n";
    tableData.forEach((row) => {
      const statusLabel = row.status === 'paid' ? 'Pago' : row.status === 'pending' ? 'Pendente' : row.status === 'overdue' ? 'Vencido' : 'Misto';
      csvContent += `"${row.employerName}","${row.cnpj}",${row.count},${row.totalValue / 100},${row.paidValue / 100},${row.pendingValue / 100},"${statusLabel}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-contribuicoes-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("CSV exportado com sucesso!");
  };

  const handleExportExcel = async () => {
    if (tableData.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    try {
      const XLSX = await import("xlsx");
      
      const worksheetData = [
        ["Empresa", "CNPJ", "Qtd", "Valor Devido", "Valor Pago", "Saldo Pendente", "Situação"],
        ...tableData.map(row => [
          row.employerName,
          row.cnpj,
          row.count,
          row.totalValue / 100,
          row.paidValue / 100,
          row.pendingValue / 100,
          row.status === 'paid' ? 'Pago' : row.status === 'pending' ? 'Pendente' : row.status === 'overdue' ? 'Vencido' : 'Misto',
        ]),
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");
      XLSX.writeFile(workbook, `relatorio-contribuicoes-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast.success("Excel exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar Excel:", error);
      toast.error("Erro ao exportar Excel");
    }
  };

  const handlePrint = () => {
    window.print();
    toast.success("Janela de impressão aberta");
  };

  const handleApplyFilters = () => {
    toast.success(`Filtros aplicados: ${filteredContributions.length} contribuições encontradas`);
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Filters Section */}
      <ContributionReportFilters
        filters={filters}
        onFiltersChange={setFilters}
        employers={employers}
        contributionTypes={contributionTypes}
        isLoading={isLoading}
        onApplyFilters={handleApplyFilters}
      />

      {/* Metrics Section */}
      <ContributionReportMetrics 
        summary={summary} 
        isLoading={isLoading}
      />

      {/* Table Section */}
      <ContributionReportTable
        data={tableData}
        isLoading={isLoading}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onPrint={handlePrint}
        emptyMessage="Nenhum resultado encontrado"
      />
    </div>
  );
}
