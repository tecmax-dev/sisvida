import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Filter, X, Download, FileText, MessageCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContributionItem = any;

interface FilterState {
  status: string;
  competenceYear: string;
  competenceMonth: string;
  dueDateFrom: string;
  dueDateTo: string;
}

interface EmployerContributionFiltersProps {
  contributions: ContributionItem[];
  onFilterChange: (filtered: ContributionItem[]) => void;
  onSendOverdueWhatsApp: () => void;
  employerName: string;
  employerCnpj: string;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendente" },
  { value: "paid", label: "Pago" },
  { value: "overdue", label: "Vencido" },
  { value: "cancelled", label: "Cancelado" },
];

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

export function EmployerContributionFilters({
  contributions,
  onFilterChange,
  onSendOverdueWhatsApp,
  employerName,
  employerCnpj,
}: EmployerContributionFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    status: "all",
    competenceYear: "all",
    competenceMonth: "all",
    dueDateFrom: "",
    dueDateTo: "",
  });
  const [isOpen, setIsOpen] = useState(false);

  const years = [...new Set(contributions.map((c) => c.competence_year))].sort((a, b) => b - a);

  const applyFilters = (newFilters: FilterState) => {
    let filtered = [...contributions];

    if (newFilters.status !== "all") {
      filtered = filtered.filter((c) => c.status === newFilters.status);
    }

    if (newFilters.competenceYear !== "all") {
      filtered = filtered.filter((c) => c.competence_year === parseInt(newFilters.competenceYear));
    }

    if (newFilters.competenceMonth !== "all") {
      filtered = filtered.filter((c) => c.competence_month === parseInt(newFilters.competenceMonth));
    }

    if (newFilters.dueDateFrom) {
      filtered = filtered.filter((c) => c.due_date >= newFilters.dueDateFrom);
    }

    if (newFilters.dueDateTo) {
      filtered = filtered.filter((c) => c.due_date <= newFilters.dueDateTo);
    }

    onFilterChange(filtered);
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    applyFilters(newFilters);
  };

  const clearFilters = () => {
    const cleared: FilterState = {
      status: "all",
      competenceYear: "all",
      competenceMonth: "all",
      dueDateFrom: "",
      dueDateTo: "",
    };
    setFilters(cleared);
    applyFilters(cleared);
  };

  const hasActiveFilters = 
    filters.status !== "all" ||
    filters.competenceYear !== "all" ||
    filters.competenceMonth !== "all" ||
    filters.dueDateFrom !== "" ||
    filters.dueDateTo !== "";

  const overdueCount = contributions.filter((c) => c.status === "overdue").length;

  const exportDetailedPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("EXTRATO DE CONTRIBUIÇÕES", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Empresa: ${employerName}`, 14, 35);
    doc.text(`CNPJ: ${employerCnpj}`, 14, 42);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 14, 49);

    // Filter applied contributions or all
    const dataToExport = hasActiveFilters 
      ? contributions.filter((c) => {
          let pass = true;
          if (filters.status !== "all") pass = pass && c.status === filters.status;
          if (filters.competenceYear !== "all") pass = pass && c.competence_year === parseInt(filters.competenceYear);
          if (filters.competenceMonth !== "all") pass = pass && c.competence_month === parseInt(filters.competenceMonth);
          if (filters.dueDateFrom) pass = pass && c.due_date >= filters.dueDateFrom;
          if (filters.dueDateTo) pass = pass && c.due_date <= filters.dueDateTo;
          return pass;
        })
      : contributions;

    // Summary
    const totalValue = dataToExport.reduce((acc, c) => acc + c.value, 0);
    const paidValue = dataToExport.filter((c) => c.status === "paid").reduce((acc, c) => acc + (c.paid_value || c.value), 0);
    const pendingValue = dataToExport.filter((c) => c.status === "pending").reduce((acc, c) => acc + c.value, 0);
    const overdueValue = dataToExport.filter((c) => c.status === "overdue").reduce((acc, c) => acc + c.value, 0);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo:", 14, 60);
    doc.setFont("helvetica", "normal");
    doc.text(`Total de Contribuições: ${dataToExport.length}`, 14, 67);
    doc.text(`Valor Total: ${formatCurrency(totalValue)}`, 14, 74);
    doc.text(`Valor Pago: ${formatCurrency(paidValue)}`, 100, 67);
    doc.text(`Valor Pendente: ${formatCurrency(pendingValue)}`, 100, 74);
    doc.text(`Valor Vencido: ${formatCurrency(overdueValue)}`, 100, 81);

    // Table
    const tableData = dataToExport.map((c) => [
      c.contribution_types?.name || "-",
      `${MONTHS[c.competence_month - 1]?.slice(0, 3)}/${c.competence_year}`,
      format(new Date(c.due_date + "T12:00:00"), "dd/MM/yyyy"),
      formatCurrency(c.value),
      c.status === "paid" ? "Pago" : c.status === "overdue" ? "Vencido" : c.status === "cancelled" ? "Cancelado" : "Pendente",
      c.paid_at ? format(new Date(c.paid_at), "dd/MM/yyyy") : "-",
      c.paid_value ? formatCurrency(c.paid_value) : "-",
    ]);

    autoTable(doc, {
      startY: 90,
      head: [["Tipo", "Competência", "Vencimento", "Valor", "Status", "Pago em", "Valor Pago"]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    doc.save(`extrato-${employerName.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Quick status filters */}
      <div className="flex gap-1">
        {STATUS_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={filters.status === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange("status", opt.value)}
            className="text-xs h-8"
          >
            {opt.label}
            {opt.value !== "all" && (
              <span className="ml-1 opacity-70">
                ({contributions.filter((c) => c.status === opt.value).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Advanced filters popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1 h-8">
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {hasActiveFilters && (
              <span className="ml-1 bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                !
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Filtros Avançados</h4>
              <p className="text-sm text-muted-foreground">
                Refine a lista de contribuições
              </p>
            </div>
            
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Ano</Label>
                  <Select
                    value={filters.competenceYear}
                    onValueChange={(v) => handleFilterChange("competenceYear", v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {years.map((y) => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mês</Label>
                  <Select
                    value={filters.competenceMonth}
                    onValueChange={(v) => handleFilterChange("competenceMonth", v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Vencimento de:</Label>
                <Input
                  type="date"
                  value={filters.dueDateFrom}
                  onChange={(e) => handleFilterChange("dueDateFrom", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Vencimento até:</Label>
                <Input
                  type="date"
                  value={filters.dueDateTo}
                  onChange={(e) => handleFilterChange("dueDateTo", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="h-3.5 w-3.5" />
                Limpar Filtros
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex-1" />

      {/* Actions */}
      {overdueCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={onSendOverdueWhatsApp}
          className="gap-1 h-8 border-amber-500 text-amber-600 hover:bg-amber-50"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Cobrar Vencidos ({overdueCount})
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={exportDetailedPDF}
        className="gap-1 h-8"
      >
        <FileText className="h-3.5 w-3.5" />
        Extrato PDF
      </Button>
    </div>
  );
}
