import { useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Search, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LytexReportFiltersState {
  startDate: Date;
  endDate: Date;
  employerId?: string;
  employerSearch: string;
  cnpjSearch: string;
  status: string;
  contributionType?: string;
  grouping?: 'daily' | 'monthly' | 'yearly';
}

interface LytexReportFiltersProps {
  filters: LytexReportFiltersState;
  onFiltersChange: (filters: LytexReportFiltersState) => void;
  employers?: { id: string; name: string; cnpj: string }[];
  contributionTypes?: { id: string; name: string }[];
  showGrouping?: boolean;
  showContributionType?: boolean;
}

const QUICK_PERIODS = [
  { label: 'Este mês', getValue: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
  { label: 'Mês anterior', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'Últimos 3 meses', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 2)), end: endOfMonth(new Date()) }) },
  { label: 'Últimos 6 meses', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 5)), end: endOfMonth(new Date()) }) },
  { label: 'Este ano', getValue: () => ({ start: new Date(new Date().getFullYear(), 0, 1), end: new Date() }) },
];

export function LytexReportFilters({
  filters,
  onFiltersChange,
  employers = [],
  contributionTypes = [],
  showGrouping = false,
  showContributionType = false,
}: LytexReportFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleQuickPeriod = (getValue: () => { start: Date; end: Date }) => {
    const { start, end } = getValue();
    onFiltersChange({ ...filters, startDate: start, endDate: end });
  };

  const clearFilters = () => {
    onFiltersChange({
      ...filters,
      employerId: undefined,
      employerSearch: '',
      cnpjSearch: '',
      status: 'all',
      contributionType: undefined,
    });
  };

  const hasActiveFilters = 
    filters.employerId || 
    filters.employerSearch || 
    filters.cnpjSearch || 
    filters.status !== 'all' ||
    filters.contributionType;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Quick Period Buttons */}
        <div className="flex flex-wrap gap-2">
          {QUICK_PERIODS.map((period) => (
            <Button
              key={period.label}
              variant="outline"
              size="sm"
              onClick={() => handleQuickPeriod(period.getValue)}
              className="text-xs"
            >
              {period.label}
            </Button>
          ))}
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Data Inicial</Label>
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

          <div className="space-y-1.5">
            <Label className="text-xs">Data Final</Label>
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

          <div className="space-y-1.5">
            <Label className="text-xs">Buscar Empresa</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome da empresa..."
                value={filters.employerSearch}
                onChange={(e) => onFiltersChange({ ...filters, employerSearch: e.target.value })}
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="overdue">Vencido</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Advanced Filters Toggle */}
        <div className="flex items-center gap-2">
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
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t">
            <div className="space-y-1.5">
              <Label className="text-xs">CNPJ</Label>
              <Input
                placeholder="00.000.000/0000-00"
                value={filters.cnpjSearch}
                onChange={(e) => onFiltersChange({ ...filters, cnpjSearch: e.target.value })}
              />
            </div>

            {showContributionType && contributionTypes.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de Contribuição</Label>
                <Select
                  value={filters.contributionType || 'all'}
                  onValueChange={(value) => onFiltersChange({ ...filters, contributionType: value === 'all' ? undefined : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {contributionTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showGrouping && (
              <div className="space-y-1.5">
                <Label className="text-xs">Agrupamento</Label>
                <Select
                  value={filters.grouping || 'monthly'}
                  onValueChange={(value) => onFiltersChange({ ...filters, grouping: value as 'daily' | 'monthly' | 'yearly' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
