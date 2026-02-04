import { useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarIcon, 
  Search, 
  Filter, 
  X, 
  Building2, 
  HelpCircle,
  BarChart3,
  List,
  TrendingUp,
  AlertTriangle,
  Calendar as CalendarDays,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmployerSearchCombobox } from "@/components/contributions/EmployerSearchCombobox";

export type ReportCategory = 'by-employer' | 'by-period' | 'by-status' | 'comparative';
export type DateFilterType = 'competence' | 'due_date' | 'paid_at';

export interface ContributionReportFiltersState {
  startDate: Date;
  endDate: Date;
  selectedEmployer: { id: string; name: string; cnpj: string } | null;
  status: string;
  contributionTypeId: string;
  reportCategory: ReportCategory;
  dateFilterType: DateFilterType;
  originFilter: string;
}

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
}

interface ContributionReportFiltersProps {
  filters: ContributionReportFiltersState;
  onFiltersChange: (filters: ContributionReportFiltersState) => void;
  employers: Employer[];
  contributionTypes: ContributionType[];
  isLoading?: boolean;
  onApplyFilters: () => void;
}

const QUICK_PERIODS = [
  { label: 'Este mês', getValue: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
  { label: 'Mês anterior', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'Últimos 3 meses', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 2)), end: endOfMonth(new Date()) }) },
  { label: 'Últimos 6 meses', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 5)), end: endOfMonth(new Date()) }) },
  { label: 'Este ano', getValue: () => ({ start: startOfYear(new Date()), end: endOfYear(new Date()) }) },
  { label: 'Ano anterior', getValue: () => ({ start: startOfYear(subMonths(new Date(), 12)), end: endOfYear(subMonths(new Date(), 12)) }) },
];

const REPORT_CATEGORIES: { value: ReportCategory; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'by-employer', label: 'Por Empresa', icon: <Building2 className="h-4 w-4" />, description: 'Agrupa resultados por empresa' },
  { value: 'by-period', label: 'Por Período', icon: <CalendarDays className="h-4 w-4" />, description: 'Agrupa por mês/ano de competência' },
  { value: 'by-status', label: 'Por Situação', icon: <List className="h-4 w-4" />, description: 'Segmenta por status de pagamento' },
  { value: 'comparative', label: 'Comparativo', icon: <TrendingUp className="h-4 w-4" />, description: 'Comparação anual/mensal' },
];

export function ContributionReportFilters({
  filters,
  onFiltersChange,
  employers,
  contributionTypes,
  isLoading = false,
  onApplyFilters,
}: ContributionReportFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleQuickPeriod = (getValue: () => { start: Date; end: Date }) => {
    const { start, end } = getValue();
    onFiltersChange({ ...filters, startDate: start, endDate: end });
  };

  const clearFilters = () => {
    onFiltersChange({
      ...filters,
      selectedEmployer: null,
      status: 'hide_cancelled',
      contributionTypeId: 'all',
      originFilter: 'all',
    });
  };

  const hasActiveFilters = 
    filters.selectedEmployer || 
    filters.status !== 'hide_cancelled' ||
    filters.contributionTypeId !== 'all' ||
    filters.originFilter !== 'all';

  const currentCategory = REPORT_CATEGORIES.find(c => c.value === filters.reportCategory);

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Filtros de Pesquisa
            </CardTitle>
            <CardDescription>
              Configure os filtros para gerar o relatório desejado
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-sm">
                  Use os filtros para personalizar seu relatório. Você pode combinar múltiplos filtros 
                  para obter resultados mais específicos.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Period Buttons */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" />
            Período Rápido
          </Label>
          <div className="flex flex-wrap gap-2">
            {QUICK_PERIODS.map((period) => (
              <Button
                key={period.label}
                variant="outline"
                size="sm"
                onClick={() => handleQuickPeriod(period.getValue)}
                className="text-xs hover:bg-primary/10 hover:border-primary/30"
              >
                {period.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Report Category Selector */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            Categoria de Relatório
          </Label>
          <Select 
            value={filters.reportCategory} 
            onValueChange={(v) => onFiltersChange({ ...filters, reportCategory: v as ReportCategory })}
          >
            <SelectTrigger className="w-full md:w-[280px]">
              <SelectValue>
                <div className="flex items-center gap-2">
                  {currentCategory?.icon}
                  <span>{currentCategory?.label}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REPORT_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  <div className="flex items-center gap-2">
                    {cat.icon}
                    <div className="flex flex-col">
                      <span className="font-medium">{cat.label}</span>
                      <span className="text-xs text-muted-foreground">{cat.description}</span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Main Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Range - Start */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              Data Inicial
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.startDate ? format(filters.startDate, "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50" align="start">
                <Calendar
                  mode="single"
                  selected={filters.startDate}
                  onSelect={(date) => date && onFiltersChange({ ...filters, startDate: date })}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date Range - End */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              Data Final
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.endDate ? format(filters.endDate, "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50" align="start">
                <Calendar
                  mode="single"
                  selected={filters.endDate}
                  onSelect={(date) => date && onFiltersChange({ ...filters, endDate: date })}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Status Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Situação da Contribuição
            </Label>
            <Select
              value={filters.status}
              onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hide_cancelled">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-gray-400" />
                    Ocultar Cancelados
                  </div>
                </SelectItem>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-gray-400" />
                    Todos
                  </div>
                </SelectItem>
                <SelectItem value="paid">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    Pagos
                  </div>
                </SelectItem>
                <SelectItem value="pending">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    Pendentes
                  </div>
                </SelectItem>
                <SelectItem value="overdue">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-rose-500" />
                    Vencidos
                  </div>
                </SelectItem>
                <SelectItem value="cancelled">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-gray-500" />
                    Cancelados
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Contribution Type Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de Contribuição</Label>
            <Select
              value={filters.contributionTypeId}
              onValueChange={(value) => onFiltersChange({ ...filters, contributionTypeId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {contributionTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Employer Search - Full Width */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            Buscar Empresa (auto-sugestão)
          </Label>
          <EmployerSearchCombobox
            employers={employers}
            value={filters.selectedEmployer?.id || null}
            onSelect={(employer) => onFiltersChange({ ...filters, selectedEmployer: employer })}
            placeholder="Digite o nome, nome fantasia ou CNPJ da empresa..."
          />
        </div>

        {/* Selected Employer Badge */}
        {filters.selectedEmployer && (
          <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              Filtrando por: {filters.selectedEmployer.name}
            </span>
            <Badge variant="outline" className="font-mono text-xs">
              {filters.selectedEmployer.cnpj}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 ml-auto"
              onClick={() => onFiltersChange({ ...filters, selectedEmployer: null })}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Advanced Filters Toggle */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs"
          >
            <Filter className="h-3.5 w-3.5 mr-1" />
            {showAdvanced ? 'Menos filtros' : 'Mais filtros'}
          </Button>
          
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-xs text-destructive hover:text-destructive"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Limpar filtros
            </Button>
          )}

          <div className="ml-auto">
            <Button 
              onClick={onApplyFilters}
              disabled={isLoading}
              className="gap-2"
            >
              <Search className="h-4 w-4" />
              Aplicar Filtros
            </Button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t animate-in fade-in duration-200">
            {/* Date Filter Type */}
            <div className="space-y-1.5">
              <Label className="text-xs">Filtrar Datas Por</Label>
              <Select
                value={filters.dateFilterType}
                onValueChange={(value) => onFiltersChange({ ...filters, dateFilterType: value as DateFilterType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="competence">Competência</SelectItem>
                  <SelectItem value="due_date">Vencimento</SelectItem>
                  <SelectItem value="paid_at">Data de Pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Origin Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs">Origem</Label>
              <Select
                value={filters.originFilter}
                onValueChange={(value) => onFiltersChange({ ...filters, originFilter: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas origens" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas origens</SelectItem>
                  <SelectItem value="lytex">Lytex</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="import">Importação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
