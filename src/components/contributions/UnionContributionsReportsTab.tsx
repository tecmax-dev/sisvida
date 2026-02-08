import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  TrendingUp,
  ChevronDown,
  AlertTriangle,
  BarChart3,
  List,
  FileSearch,
  Loader2,
  RefreshCw,
  Search,
  Check,
  Tags,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EmployerSearchCombobox } from "./EmployerSearchCombobox";
import { generateContributionsReport } from "@/lib/contributions-report-pdf";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useContributionsReport, ContributionReportFilters } from "@/hooks/useContributionsReport";

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

interface UnionContributionsReportsTabProps {
  clinicId: string;
  employers: Employer[];
  contributionTypes: ContributionType[];
  clinicName?: string;
  clinicLogo?: string;
}

type ReportType = 'general' | 'by-employer' | 'synthetic' | 'analytical' | 'defaulting';

const REPORT_TYPES: { value: ReportType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'general', label: 'Relatório Geral', icon: <BarChart3 className="h-4 w-4" />, description: 'Visão consolidada de todas as empresas' },
  { value: 'by-employer', label: 'Por Empresa', icon: <Building2 className="h-4 w-4" />, description: 'Detalhado por empresa selecionada' },
  { value: 'synthetic', label: 'Sintético', icon: <TrendingUp className="h-4 w-4" />, description: 'Apenas totais consolidados' },
  { value: 'analytical', label: 'Analítico', icon: <List className="h-4 w-4" />, description: 'Listagem completa para auditoria' },
  { value: 'defaulting', label: 'Inadimplência', icon: <AlertTriangle className="h-4 w-4" />, description: 'Apenas pendentes e vencidos' },
];

export default function UnionContributionsReportsTab({
  clinicId,
  employers,
  contributionTypes,
  clinicName,
  clinicLogo,
}: UnionContributionsReportsTabProps) {
  const { session } = useAuth();
  
  // LocalStorage key for persisting filters - with version to invalidate old cache
  // CRITICAL: Increment version when default filters change to force users to get new defaults
  const STORAGE_VERSION = "v3"; // v3: Force due_date filter + 5 year range
  const STORAGE_KEY = `union-contributions-report-filters-${clinicId}-${STORAGE_VERSION}`;
  
  // Helper to get saved filters from localStorage - with aggressive cleanup of old versions
  const getSavedFilters = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log("[UnionContributionsReportsTab] Loaded saved filters:", parsed);
        return parsed;
      }
      // Clean up ALL old version keys
      const keysToClean = [
        `union-contributions-report-filters-${clinicId}`,
        `union-contributions-report-filters-${clinicId}-v1`,
        `union-contributions-report-filters-${clinicId}-v2`,
      ];
      keysToClean.forEach(key => {
        if (localStorage.getItem(key)) {
          console.log("[UnionContributionsReportsTab] Removing old filter key:", key);
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn("Erro ao recuperar filtros salvos:", e);
    }
    return null;
  }, [STORAGE_KEY, clinicId]);

  // Date helpers - stable references
  const toInputDate = useCallback((d: Date) => format(d, "yyyy-MM-dd"), []);
  
  // Calculate default date range - go back to 2020 to cover all historical data
  const getDefaultStartDate = useCallback(() => {
    // Start from 2020-01-01 to capture all historical overdue contributions
    return "2020-01-01";
  }, []);
  
  // Initialize states from localStorage or defaults
  const savedFilters = getSavedFilters();
  
  const [reportType, setReportType] = useState<ReportType>(
    savedFilters?.reportType || "general"
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    savedFilters?.statusFilter || "hide_cancelled"
  );
  const [selectedEmployer, setSelectedEmployer] = useState<Employer | null>(
    savedFilters?.selectedEmployer || null
  );
  const [selectedContributionTypes, setSelectedContributionTypes] = useState<string[]>(
    savedFilters?.selectedContributionTypes || []
  );
  const [originFilter, setOriginFilter] = useState<string>(
    savedFilters?.originFilter || "all"
  );
  // Default to due_date filter type to properly show overdue contributions
  const [dateFilterType, setDateFilterType] = useState<"competence" | "due_date" | "paid_at">(
    savedFilters?.dateFilterType || "due_date"
  );
  // Use wider date range by default to capture historical overdue contributions
  const [startDate, setStartDate] = useState<string>(
    savedFilters?.startDate || getDefaultStartDate()
  );
  const [endDate, setEndDate] = useState<string>(
    savedFilters?.endDate || toInputDate(endOfMonth(new Date()))
  );

  // Track if user manually touched dates
  const dateTouchedRef = useRef(false);

  // Auto-save filters to localStorage whenever they change
  useEffect(() => {
    const filtersToSave = {
      reportType,
      statusFilter,
      selectedEmployer,
      selectedContributionTypes,
      originFilter,
      dateFilterType,
      startDate,
      endDate,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtersToSave));
    } catch (e) {
      console.warn("Erro ao salvar filtros:", e);
    }
  }, [reportType, statusFilter, selectedEmployer, selectedContributionTypes, originFilter, dateFilterType, startDate, endDate, STORAGE_KEY]);

  // Use the hook for data fetching with SQL filters
  const {
    contributions,
    loading,
    error,
    fetchContributions,
    summary,
    byEmployerReport,
  } = useContributionsReport(clinicId);

  // Build filters object
  const buildFilters = useCallback((): ContributionReportFilters => {
    // For "defaulting" report type, force status to show only pending/overdue
    let effectiveStatus = statusFilter;
    if (reportType === 'defaulting') {
      // Use special filter that will be handled to show both pending and overdue
      effectiveStatus = 'defaulting'; 
    }

    return {
      startDate,
      endDate,
      dateFilterType,
      status: effectiveStatus,
      employerId: selectedEmployer?.id,
      contributionTypeIds: selectedContributionTypes.length > 0 ? selectedContributionTypes : undefined,
      origin: originFilter !== "all" ? originFilter : undefined,
    };
  }, [startDate, endDate, dateFilterType, statusFilter, selectedEmployer, selectedContributionTypes, originFilter, reportType]);

  // Reset filters to defaults
  const handleResetFilters = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setReportType("general");
    setStatusFilter("hide_cancelled");
    setSelectedEmployer(null);
    setSelectedContributionTypes([]);
    setOriginFilter("all");
    setDateFilterType("due_date");
    setStartDate(getDefaultStartDate());
    setEndDate(toInputDate(endOfMonth(new Date())));
    toast.success("Filtros resetados");
  }, [STORAGE_KEY, getDefaultStartDate, toInputDate]);

  // Toggle contribution type selection
  const toggleContributionType = (typeId: string) => {
    setSelectedContributionTypes(prev => 
      prev.includes(typeId) 
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  };

  // Select/deselect all contribution types
  const toggleAllContributionTypes = () => {
    if (selectedContributionTypes.length === contributionTypes.length) {
      setSelectedContributionTypes([]);
    } else {
      setSelectedContributionTypes(contributionTypes.map(t => t.id));
    }
  };

  // Get label for contribution types button
  const getContributionTypesLabel = () => {
    if (selectedContributionTypes.length === 0) {
      return "Todos os tipos";
    }
    if (selectedContributionTypes.length === 1) {
      const type = contributionTypes.find(t => t.id === selectedContributionTypes[0]);
      return type?.name || "1 tipo";
    }
    return `${selectedContributionTypes.length} tipos selecionados`;
  };

  // Fetch on mount and when filters change
  const handleSearch = useCallback(() => {
    const filters = buildFilters();
    console.log("[UnionContributionsReportsTab] Searching with filters:", JSON.stringify(filters, null, 2));
    fetchContributions(filters);
  }, [buildFilters, fetchContributions]);

  // Track if initial load has happened
  const initialLoadDone = useRef(false);
  
  // Initial fetch on mount
  useEffect(() => {
    if (clinicId) {
      console.log("[UnionContributionsReportsTab] Initial fetch for clinic:", clinicId);
      handleSearch();
      initialLoadDone.current = true;
    }
  }, [clinicId]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Auto-search when any filter changes (employer, report type, dates, status, etc.)
  useEffect(() => {
    // Only auto-search after initial load
    if (clinicId && initialLoadDone.current) {
      console.log("[UnionContributionsReportsTab] Filters changed, auto-searching...", {
        employer: selectedEmployer?.id,
        reportType,
        statusFilter,
        dateFilterType,
        startDate,
        endDate,
        origin: originFilter,
        contributionTypes: selectedContributionTypes.length
      });
      // Small delay to batch multiple filter changes
      const timeout = setTimeout(() => {
        handleSearch();
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [selectedEmployer?.id, reportType, statusFilter, dateFilterType, startDate, endDate, originFilter, selectedContributionTypes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Contributions to display (already filtered by the hook at database level)
  const displayContributions = useMemo(() => {
    // No additional filtering needed - the hook already handles status filtering at database level
    return contributions;
  }, [contributions]);

  // Recalculate summary for display
  const displaySummary = useMemo(() => {
    const total = displayContributions.reduce((acc, c) => acc + c.value, 0);
    const paid = displayContributions
      .filter((c) => c.status === "paid")
      .reduce((acc, c) => acc + (c.paid_value || c.value), 0);
    const pending = displayContributions
      .filter((c) => c.status === "pending")
      .reduce((acc, c) => acc + c.value, 0);
    const overdue = displayContributions
      .filter((c) => c.status === "overdue")
      .reduce((acc, c) => acc + c.value, 0);
    
    const totalFees = displayContributions.reduce((acc, c) => acc + (c.lytex_fee_amount || 0), 0);
    const totalNet = displayContributions
      .filter((c) => c.status === "paid")
      .reduce((acc, c) => acc + (c.net_value || c.paid_value || c.value), 0);

    return { 
      total, 
      paid, 
      pending, 
      overdue, 
      count: displayContributions.length, 
      totalFees, 
      totalNet 
    };
  }, [displayContributions]);

  // Recalculate by employer for display
  const displayByEmployerReport = useMemo(() => {
    const data = new Map<string, {
      employer: Employer;
      total: number;
      paid: number;
      pending: number;
      overdue: number;
      count: number;
    }>();

    displayContributions.forEach((c) => {
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
  }, [displayContributions]);

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

  const periodLabel = useMemo(() => {
    if (startDate && endDate) {
      return `${format(new Date(startDate + "T12:00:00"), "dd/MM/yyyy")} a ${format(new Date(endDate + "T12:00:00"), "dd/MM/yyyy")}`;
    }
    return "Período não definido";
  }, [startDate, endDate]);

  const handleExportCSV = () => {
    let csvContent = "Empresa,CNPJ,Qtd,Total,Pago,Pendente,Vencido\n";
    displayByEmployerReport.forEach((row) => {
      csvContent += `"${row.employer.name}","${row.employer.cnpj}",${row.count},${row.total / 100},${row.paid / 100},${row.pending / 100},${row.overdue / 100}\n`;
    });
    const startLabel = startDate ? startDate.replace(/-/g, "") : "inicio";
    const endLabel = endDate ? endDate.replace(/-/g, "") : "fim";
    const filename = `contribuicoes-${startLabel}-a-${endLabel}.csv`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    toast.success("CSV exportado com sucesso!");
  };

  const handleExportPDF = async () => {
    if (displayContributions.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    const reportData = {
      contributions: displayContributions,
      summary: displaySummary,
      byEmployerReport: displayByEmployerReport,
    };

    const selectedTypeName = selectedContributionTypes.length > 0 
      ? selectedContributionTypes.length === 1 
        ? contributionTypes.find(t => t.id === selectedContributionTypes[0])?.name 
        : `${selectedContributionTypes.length} tipos`
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

            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">De:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  dateTouchedRef.current = true;
                  setStartDate(e.target.value);
                }}
                className="h-9 px-3 rounded-md border border-input bg-background text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Até:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  dateTouchedRef.current = true;
                  setEndDate(e.target.value);
                }}
                className="h-9 px-3 rounded-md border border-input bg-background text-sm"
              />
            </div>

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

            {/* Contribution Type Multi-Select */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <Tags className="h-4 w-4 shrink-0" />
                    <span className="truncate">{getContributionTypesLabel()}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <div className="p-2 border-b">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-xs"
                    onClick={toggleAllContributionTypes}
                  >
                    <Check className={`h-3 w-3 mr-2 ${selectedContributionTypes.length === contributionTypes.length ? 'opacity-100' : 'opacity-0'}`} />
                    {selectedContributionTypes.length === contributionTypes.length ? 'Desmarcar todos' : 'Selecionar todos'}
                  </Button>
                </div>
                <div className="max-h-[200px] overflow-y-auto p-2 space-y-1">
                  {contributionTypes.map((type) => (
                    <div 
                      key={type.id} 
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                      onClick={() => toggleContributionType(type.id)}
                    >
                      <Checkbox 
                        checked={selectedContributionTypes.includes(type.id)}
                        onCheckedChange={() => toggleContributionType(type.id)}
                      />
                      <span className="text-sm">{type.name}</span>
                    </div>
                  ))}
                </div>
                {selectedContributionTypes.length > 0 && (
                  <div className="p-2 border-t">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-xs text-muted-foreground"
                      onClick={() => setSelectedContributionTypes([])}
                    >
                      Limpar seleção
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Origin Filter */}
            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas origens</SelectItem>
                <SelectItem value="pj">PJ (Empresas)</SelectItem>
                <SelectItem value="pf">PF (Sócios)</SelectItem>
              </SelectContent>
            </Select>

            {/* Search Button */}
            <Button 
              onClick={handleSearch} 
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Buscar
            </Button>
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

          {/* Error message */}
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-l-4 border-l-slate-600">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Bruto</p>
            <p className="text-xl font-bold">{formatCurrency(displaySummary.total)}</p>
            <p className="text-xs text-muted-foreground">{displaySummary.count} contribuições</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Recebido</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(displaySummary.paid)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Taxas Lytex</p>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(displaySummary.totalFees)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Líquido</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(displaySummary.totalNet)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(displaySummary.pending)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Vencido</p>
            <p className="text-xl font-bold text-rose-600">{formatCurrency(displaySummary.overdue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary by Employer Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Resumo por Empresa
            </CardTitle>
            <CardDescription>
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Buscando contribuições...
                </span>
              ) : (
                <>
                  {displayByEmployerReport.length} empresas no período selecionado
                </>
              )}
            </CardDescription>
          </div>
          
          {/* Export Dropdown - Only show when there are results */}
          {displayByEmployerReport.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Exportar</span>
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
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando dados do banco...</p>
            </div>
          ) : (
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
                  {displayByEmployerReport.length > 0 ? (
                    displayByEmployerReport.map((row) => (
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
                          <p className="text-sm">Clique em "Buscar" para carregar os dados com os filtros atuais</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Contributions Table */}
      {!loading && displayContributions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <List className="h-4 w-4" />
              Listagem Detalhada
            </CardTitle>
            <CardDescription>
              {displayContributions.length} contribuições encontradas
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto" style={{ maxHeight: "600px" }}>
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted/50">
                    <TableHead>Empresa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-center">Competência</TableHead>
                    <TableHead className="text-center">Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Pagamento</TableHead>
                    <TableHead className="text-right">Valor Pago</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayContributions.map((contribution) => (
                    <TableRow key={contribution.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {contribution.employers?.name || "-"}
                          </p>
                          {contribution.employers?.trade_name && contribution.employers.trade_name !== contribution.employers.name && (
                            <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                              {contribution.employers.trade_name}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {contribution.employers?.cnpj && (
                              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                {formatCNPJ(contribution.employers.cnpj)}
                              </span>
                            )}
                            {contribution.employers?.registration_number && (
                              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                                Mat: {contribution.employers.registration_number}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {contribution.contribution_types?.name || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {String(contribution.competence_month).padStart(2, "0")}/{contribution.competence_year}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {contribution.due_date 
                          ? format(new Date(contribution.due_date + "T12:00:00"), "dd/MM/yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(contribution.value)}
                      </TableCell>
                      <TableCell className="text-center">
                        {contribution.status === "paid" && (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            Pago
                          </Badge>
                        )}
                        {contribution.status === "pending" && (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                            Pendente
                          </Badge>
                        )}
                        {contribution.status === "overdue" && (
                          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
                            Vencido
                          </Badge>
                        )}
                        {contribution.status === "cancelled" && (
                          <Badge variant="secondary">
                            Cancelado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {contribution.paid_at 
                          ? format(new Date(contribution.paid_at), "dd/MM/yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {contribution.paid_value ? formatCurrency(contribution.paid_value) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
              {displayContributions.length} registro(s)
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
