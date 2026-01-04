import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Filter, X, FileText, AlertTriangle, Settings2 } from "lucide-react";
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

interface PdfFieldOption {
  key: string;
  label: string;
  enabled: boolean;
}

interface ClinicInfo {
  name: string;
  cnpj?: string | null;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
}

interface EmployerContributionFiltersProps {
  contributions: ContributionItem[];
  onFilterChange: (filtered: ContributionItem[]) => void;
  onSendOverdueWhatsApp: () => void;
  employerName: string;
  employerCnpj: string;
  clinicInfo?: ClinicInfo;
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

const DEFAULT_PDF_FIELDS: PdfFieldOption[] = [
  { key: "type", label: "Tipo de Contribuição", enabled: true },
  { key: "competence", label: "Competência", enabled: true },
  { key: "due_date", label: "Vencimento", enabled: true },
  { key: "value", label: "Valor", enabled: true },
  { key: "status", label: "Status", enabled: true },
  { key: "paid_at", label: "Data Pagamento", enabled: true },
  { key: "paid_value", label: "Valor Pago", enabled: true },
  { key: "notes", label: "Observações", enabled: false },
];

export function EmployerContributionFilters({
  contributions,
  onFilterChange,
  onSendOverdueWhatsApp,
  employerName,
  employerCnpj,
  clinicInfo,
}: EmployerContributionFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    status: "all",
    competenceYear: "all",
    competenceMonth: "all",
    dueDateFrom: "",
    dueDateTo: "",
  });
  const [isOpen, setIsOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfFields, setPdfFields] = useState<PdfFieldOption[]>(DEFAULT_PDF_FIELDS);
  const [showLogo, setShowLogo] = useState(true);
  const [showClinicInfo, setShowClinicInfo] = useState(true);

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

  const togglePdfField = (key: string) => {
    setPdfFields(prev => 
      prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f)
    );
  };

  const getEnabledFields = () => pdfFields.filter(f => f.enabled);

  const exportDetailedPDF = async () => {
    const doc = new jsPDF();
    let yPos = 15;
    
    // Load logo if enabled and available
    if (showLogo && clinicInfo?.logoUrl) {
      try {
        // Use crossOrigin to avoid CORS taint issues
        const logoHeight = await new Promise<number>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            try {
              const canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext("2d");
              if (!ctx) {
                resolve(0);
                return;
              }
              ctx.drawImage(img, 0, 0);
              const pngData = canvas.toDataURL("image/png");

              const maxWidth = 40;
              const maxHeight = 20;
              const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
              const width = img.width * ratio;
              const height = img.height * ratio;
              doc.addImage(pngData, "PNG", 14, yPos, width, height);
              resolve(height + 5);
            } catch {
              resolve(0);
            }
          };
          img.onerror = () => resolve(0);
          img.src = clinicInfo.logoUrl;
        });
        yPos += logoHeight;
      } catch {
        // Continue without logo
      }
    }

    // Clinic header info
    if (showClinicInfo && clinicInfo) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(clinicInfo.name, 14, yPos);
      yPos += 6;
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      if (clinicInfo.cnpj) {
        doc.text(`CNPJ: ${clinicInfo.cnpj}`, 14, yPos);
        yPos += 5;
      }
      if (clinicInfo.phone) {
        doc.text(`Tel: ${clinicInfo.phone}`, 14, yPos);
        yPos += 5;
      }
      if (clinicInfo.address) {
        doc.text(clinicInfo.address, 14, yPos);
        yPos += 5;
      }
      yPos += 5;
    }

    // Title
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("EXTRATO DE CONTRIBUIÇÕES", 105, yPos, { align: "center" });
    yPos += 10;
    
    // Employer info
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Empresa: ${employerName}`, 14, yPos);
    yPos += 5;
    doc.text(`CNPJ: ${employerCnpj}`, 14, yPos);
    yPos += 5;
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 14, yPos);
    yPos += 10;

    // Filter applied contributions
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

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo:", 14, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`Total: ${dataToExport.length} contribuições  |  Valor Total: ${formatCurrency(totalValue)}`, 14, yPos);
    yPos += 5;
    doc.text(`Pago: ${formatCurrency(paidValue)}  |  Pendente: ${formatCurrency(pendingValue)}  |  Vencido: ${formatCurrency(overdueValue)}`, 14, yPos);
    yPos += 10;

    // Build dynamic columns based on enabled fields
    const enabledFields = getEnabledFields();
    const headers: string[] = [];
    const fieldMap: Record<string, (c: ContributionItem) => string> = {
      type: (c) => c.contribution_types?.name || "-",
      competence: (c) => `${MONTHS[c.competence_month - 1]?.slice(0, 3)}/${c.competence_year}`,
      due_date: (c) => format(new Date(c.due_date + "T12:00:00"), "dd/MM/yyyy"),
      value: (c) => formatCurrency(c.value),
      status: (c) => c.status === "paid" ? "Pago" : c.status === "overdue" ? "Vencido" : c.status === "cancelled" ? "Cancelado" : "Pendente",
      paid_at: (c) => c.paid_at ? format(new Date(c.paid_at), "dd/MM/yyyy") : "-",
      paid_value: (c) => c.paid_value ? formatCurrency(c.paid_value) : "-",
      notes: (c) => c.notes || "-",
    };

    const headerLabels: Record<string, string> = {
      type: "Tipo",
      competence: "Competência",
      due_date: "Vencimento",
      value: "Valor",
      status: "Status",
      paid_at: "Pago em",
      paid_value: "Valor Pago",
      notes: "Observações",
    };

    enabledFields.forEach(f => headers.push(headerLabels[f.key]));

    const tableData = dataToExport.map((c) => 
      enabledFields.map(f => fieldMap[f.key](c))
    );

    autoTable(doc, {
      startY: yPos,
      head: [headers],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    doc.save(`extrato-${employerName.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    setPdfDialogOpen(false);
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
        onClick={() => setPdfDialogOpen(true)}
        className="gap-1 h-8"
      >
        <FileText className="h-3.5 w-3.5" />
        Extrato PDF
      </Button>

      {/* PDF Configuration Dialog */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Extrato PDF</DialogTitle>
            <DialogDescription>
              Selecione os campos e opções para o relatório
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Header options */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Cabeçalho</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showLogo"
                    checked={showLogo}
                    onCheckedChange={(checked) => setShowLogo(checked === true)}
                  />
                  <label htmlFor="showLogo" className="text-sm cursor-pointer">
                    Exibir logo da clínica
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showClinicInfo"
                    checked={showClinicInfo}
                    onCheckedChange={(checked) => setShowClinicInfo(checked === true)}
                  />
                  <label htmlFor="showClinicInfo" className="text-sm cursor-pointer">
                    Exibir dados da clínica (CNPJ, telefone, endereço)
                  </label>
                </div>
              </div>
            </div>

            {/* Field selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Campos do Relatório</Label>
              <div className="grid grid-cols-2 gap-2">
                {pdfFields.map((field) => (
                  <div key={field.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={field.key}
                      checked={field.enabled}
                      onCheckedChange={() => togglePdfField(field.key)}
                    />
                    <label htmlFor={field.key} className="text-sm cursor-pointer">
                      {field.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {getEnabledFields().length === 0 && (
              <p className="text-sm text-amber-600">
                Selecione pelo menos um campo para gerar o relatório.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPdfDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={exportDetailedPDF}
              disabled={getEnabledFields().length === 0}
              className="gap-1"
            >
              <FileText className="h-4 w-4" />
              Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
