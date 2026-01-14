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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


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

import { formatCompetence } from "@/lib/competence-format";

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
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    let yPos = 15;

    // Colors
    const primaryColor: [number, number, number] = [30, 64, 175]; // Blue-800
    const accentColor: [number, number, number] = [59, 130, 246]; // Blue-500
    const mutedColor: [number, number, number] = [100, 116, 139]; // Slate-500
    const successColor: [number, number, number] = [22, 163, 74]; // Green-600
    const warningColor: [number, number, number] = [202, 138, 4]; // Yellow-600
    const dangerColor: [number, number, number] = [220, 38, 38]; // Red-600

    let logoDataUrl: string | null = null;
    let logoWidth = 0;
    let logoHeight = 0;

    // Load logo if enabled and available
    if (showLogo && clinicInfo?.logoUrl) {
      const url = clinicInfo.logoUrl;
      try {
        const { data, error } = await supabase.functions.invoke("fetch-image-base64", {
          body: { url },
        });

        if (error) throw error;
        if (!data?.base64 || !data?.contentType) throw new Error("Resposta inválida ao buscar logo");

        logoDataUrl = `data:${data.contentType};base64,${data.base64}`;

        // Pre-calculate logo dimensions
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const maxWidth = 35;
            const maxHeight = 18;
            const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
            logoWidth = img.width * ratio;
            logoHeight = img.height * ratio;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = logoDataUrl!;
        });
      } catch (err: any) {
        console.error("[pdf] logo error:", err);
        toast.error("Não foi possível carregar o logo no PDF");
      }
    }

    // ========== HEADER SECTION ==========
    // Background header bar
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.rect(0, 0, pageWidth, 38, "F");

    // Logo + Clinic info side by side
    if (logoDataUrl && logoWidth > 0) {
      // Convert to PNG via canvas
      const img = new Image();
      img.src = logoDataUrl;
      await new Promise<void>((resolve) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const pngData = canvas.toDataURL("image/png");
            doc.addImage(pngData, "PNG", margin, yPos, logoWidth, logoHeight);
          }
          resolve();
        };
        img.onerror = () => resolve();
      });
    }

    // Clinic info - positioned next to logo or at start
    const textStartX = logoWidth > 0 ? margin + logoWidth + 6 : margin;
    
    if (showClinicInfo && clinicInfo) {
      doc.setTextColor(...primaryColor);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(clinicInfo.name.toUpperCase(), textStartX, yPos + 5);

      doc.setTextColor(...mutedColor);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      
      const infoItems: string[] = [];
      if (clinicInfo.cnpj) infoItems.push(`CNPJ: ${clinicInfo.cnpj}`);
      if (clinicInfo.phone) infoItems.push(`Tel: ${clinicInfo.phone}`);
      
      if (infoItems.length > 0) {
        doc.text(infoItems.join("  •  "), textStartX, yPos + 11);
      }
    }

    // Date generated - right aligned
    doc.setTextColor(...mutedColor);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pageWidth - margin, yPos + 5, { align: "right" });

    yPos = 42;

    // Header separator line
    doc.setDrawColor(...accentColor);
    doc.setLineWidth(0.8);
    doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);

    // ========== TITLE ==========
    doc.setTextColor(...primaryColor);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("EXTRATO DE CONTRIBUIÇÕES", pageWidth / 2, yPos + 8, { align: "center" });
    yPos += 18;

    // ========== EMPLOYER INFO BOX ==========
    doc.setFillColor(241, 245, 249); // Slate-100
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 18, 2, 2, "F");

    doc.setTextColor(...primaryColor);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Empresa:", margin + 4, yPos + 7);
    doc.setFont("helvetica", "normal");
    doc.text(employerName, margin + 26, yPos + 7);

    doc.setFont("helvetica", "bold");
    doc.text("CNPJ:", margin + 4, yPos + 13);
    doc.setFont("helvetica", "normal");
    doc.text(employerCnpj, margin + 20, yPos + 13);

    yPos += 24;

    // ========== SUMMARY CARDS ==========
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

    const totalValue = dataToExport.reduce((acc, c) => acc + c.value, 0);
    const paidValue = dataToExport.filter((c) => c.status === "paid").reduce((acc, c) => acc + (c.paid_value || c.value), 0);
    const pendingValue = dataToExport.filter((c) => c.status === "pending").reduce((acc, c) => acc + c.value, 0);
    const overdueValue = dataToExport.filter((c) => c.status === "overdue").reduce((acc, c) => acc + c.value, 0);

    const cardWidth = (pageWidth - 2 * margin - 9) / 4;
    const cardHeight = 16;

    const summaryCards = [
      { label: "Total", value: formatCurrency(totalValue), count: dataToExport.length, color: primaryColor },
      { label: "Pago", value: formatCurrency(paidValue), count: dataToExport.filter(c => c.status === "paid").length, color: successColor },
      { label: "Pendente", value: formatCurrency(pendingValue), count: dataToExport.filter(c => c.status === "pending").length, color: warningColor },
      { label: "Vencido", value: formatCurrency(overdueValue), count: dataToExport.filter(c => c.status === "overdue").length, color: dangerColor },
    ];

    summaryCards.forEach((card, i) => {
      const x = margin + i * (cardWidth + 3);
      
      // Card background
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...card.color);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, yPos, cardWidth, cardHeight, 1.5, 1.5, "FD");

      // Left accent bar
      doc.setFillColor(...card.color);
      doc.rect(x, yPos + 2, 2, cardHeight - 4, "F");

      // Label
      doc.setTextColor(...mutedColor);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(card.label.toUpperCase(), x + 5, yPos + 5);

      // Value
      doc.setTextColor(...card.color);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(card.value, x + 5, yPos + 11);

      // Count
      doc.setTextColor(...mutedColor);
      doc.setFontSize(7);
      doc.text(`(${card.count})`, x + cardWidth - 3, yPos + 11, { align: "right" });
    });

    yPos += cardHeight + 8;

    // ========== TABLE ==========
    const enabledFields = getEnabledFields();
    const headers: string[] = [];
    const fieldMap: Record<string, (c: ContributionItem) => string> = {
      type: (c) => c.contribution_types?.name || "-",
      competence: (c) => formatCompetence(c.competence_month, c.competence_year),
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
      styles: { 
        fontSize: 8, 
        cellPadding: 3,
        lineColor: [226, 232, 240], // Slate-200
        lineWidth: 0.1,
      },
      headStyles: { 
        fillColor: primaryColor, 
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        textColor: [30, 41, 59], // Slate-800
      },
      alternateRowStyles: { 
        fillColor: [248, 250, 252], // Slate-50
      },
      columnStyles: {
        0: { cellWidth: "auto" },
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data) => {
        // Footer on each page
        const footerY = pageHeight - 10;
        
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

        doc.setTextColor(...mutedColor);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");

        // Address left
        if (clinicInfo?.address) {
          doc.text(clinicInfo.address, margin, footerY);
        }

        // Page number right
        const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber;
        doc.text(`Página ${pageNum}`, pageWidth - margin, footerY, { align: "right" });
      },
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
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i} value={(i + 1).toString()}>
                          {String(i + 1).padStart(2, "0")}
                        </SelectItem>
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
