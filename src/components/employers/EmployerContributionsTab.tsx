import { useState, useMemo, useEffect } from "react";
// Print/summary refactor: totals reflect the filtered list
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Receipt,
  RefreshCw,
  MessageCircle,
  Mail,
  Plus,
  Eye,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  DollarSign,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
  FileText,
  Handshake,
  TrendingUp,
  Wallet,
  CircleDollarSign,
  Pencil,
  Printer,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EmployerContributionFilters } from "@/components/contributions/EmployerContributionFilters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Filter, X, LayoutGrid, List } from "lucide-react";

// Format currency from cents
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

// Status configuration
const STATUS_CONFIG = {
  paid: {
    label: "Pago",
    color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle2,
  },
  pending: {
    label: "Pendente",
    color: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800",
    icon: Clock,
  },
  overdue: {
    label: "Vencido",
    color: "bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800",
    icon: AlertTriangle,
  },
  cancelled: {
    label: "Cancelado",
    color: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700",
    icon: XCircle,
  },
  awaiting_value: {
    label: "Aguardando",
    color: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800",
    icon: DollarSign,
  },
  processing: {
    label: "Processando",
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800",
    icon: Loader2,
  },
  negotiated: {
    label: "Negociado",
    color: "bg-indigo-100 text-indigo-800 border-indigo-200",
    icon: FileText,
  },
};

interface Contribution {
  id: string;
  status: string;
  value: number;
  due_date: string;
  competence_month: number;
  competence_year: number;
  contribution_type_id?: string;
  lytex_invoice_id?: string | null;
  lytex_invoice_url?: string | null;
  lytex_boleto_digitable_line?: string | null;
  lytex_pix_code?: string | null;
  lytex_raw_data?: any;
  paid_at?: string | null;
  paid_value?: number | null;
  payment_method?: string | null;
  notes?: string | null;
  contribution_types?: {
    id?: string;
    name: string;
    default_value?: number;
    is_active?: boolean;
  } | null;
}

// Extracts the Lytex boleto title number ("nosso número") from raw invoice data
export function getLytexTitleNumber(contrib: { lytex_raw_data?: any }): string | null {
  const raw = contrib.lytex_raw_data;
  if (!raw) return null;

  const txs = raw.transactions;
  if (Array.isArray(txs)) {
    for (const tx of txs) {
      const n = tx?.boleto?.ourNumber;
      if (n) return String(n);
    }
  }

  // Fallback: invoices already paid may only carry ourNumber on lastPayment
  const lastPaymentNumber = raw.lastPayment?.ourNumber;
  if (lastPaymentNumber) return String(lastPaymentNumber);

  return null;
}

interface EmployerContributionsTabProps {
  contributions: Contribution[];
  contributionTypes?: { id: string; name: string }[];
  stats: {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    yearTotal: number;
    totalValue: number;
    paidValue: number;
  };
  currentClinic: any;
  employer: any;
  syncing: boolean;
  generatingInvoice: boolean;
  selectedContributionIds: Set<string>;
  setSelectedContributionIds: (ids: Set<string>) => void;
  onSyncLytex: () => void;
  onOpenWhatsappDialog: () => void;
  onOpenEmailDialog: () => void;
  onOpenCreateDialog: () => void;
  onOpenOverdueDialog: () => void;
  onViewContribution: (contrib: Contribution) => void;
  onGenerateInvoice: (contrib: Contribution) => void;
  onOpenNegotiationDialog?: () => void;
}

function formatCompetence(month: number, year: number): string {
  return `${String(month).padStart(2, "0")}/${year}`;
}

// Status Filter Badge Component
function StatusFilterBadge({
  label,
  count,
  active,
  onClick,
  variant = "default",
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  variant?: "default" | "success" | "warning" | "danger" | "muted";
}) {
  const baseClasses = "cursor-pointer transition-all px-3 py-1.5 rounded-full text-sm font-medium border";
  
  const variants = {
    default: active 
      ? "bg-primary text-primary-foreground border-primary" 
      : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted",
    success: active 
      ? "bg-emerald-500 text-white border-emerald-500" 
      : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
    warning: active 
      ? "bg-amber-500 text-white border-amber-500" 
      : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
    danger: active 
      ? "bg-rose-500 text-white border-rose-500" 
      : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100",
    muted: active 
      ? "bg-gray-500 text-white border-gray-500" 
      : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100",
  };

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variants[variant]}`}
    >
      {label} <span className="ml-1 font-bold">{count}</span>
    </button>
  );
}

// Contribution Card Component
function ContributionCard({
  contrib,
  isSelected,
  isEligible,
  onSelect,
  onView,
  onGenerateInvoice,
  generatingInvoice,
}: {
  contrib: Contribution;
  isSelected: boolean;
  isEligible: boolean;
  onSelect: () => void;
  onView: () => void;
  onGenerateInvoice: () => void;
  generatingInvoice: boolean;
}) {
  const statusConfig = STATUS_CONFIG[contrib.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <Card className={`transition-all hover:shadow-md ${isSelected ? "ring-2 ring-primary/50 bg-primary/5" : ""}`}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          {/* Left: Checkbox + Info */}
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {isEligible ? (
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelect}
                className="mt-1 shrink-0"
              />
            ) : (
              <Checkbox disabled className="opacity-30 mt-1 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{contrib.contribution_types?.name || "Contribuição"}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatCompetence(contrib.competence_month, contrib.competence_year)}
                </span>
                <span>•</span>
                <span className={contrib.status === "overdue" ? "text-rose-600 font-medium" : ""}>
                  Venc: {format(parseDateOnlyToLocalNoon(contrib.due_date), "dd/MM/yy")}
                </span>
                {contrib.status === "paid" && contrib.paid_at && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-600 font-medium">
                      Pago: {format(parseDateOnlyToLocalNoon(contrib.paid_at), "dd/MM/yy")}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Value + Status */}
          <div className="text-right shrink-0">
            <p className="font-bold text-sm">{formatCurrency(contrib.value)}</p>
            <Badge className={`${statusConfig.color} text-[10px] gap-0.5 mt-1 h-5`}>
              <StatusIcon className="h-3 w-3" />
              {statusConfig.label}
            </Badge>
          </div>
        </div>

        {/* Actions Row */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t">
          <div className="flex items-center gap-1 text-xs">
            {getLytexTitleNumber(contrib) ? (
              <span className="font-mono text-muted-foreground" title="Número do título gerado no boleto Lytex">
                Título: {getLytexTitleNumber(contrib)}
              </span>
            ) : contrib.lytex_invoice_id ? (
              <span className="font-mono text-muted-foreground">
                Doc: {contrib.lytex_invoice_id.slice(-8).toUpperCase()}
              </span>
            ) : (
              <span className="text-muted-foreground">Sem documento</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {contrib.lytex_invoice_url && contrib.status !== "paid" && contrib.status !== "cancelled" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={contrib.lytex_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md text-primary hover:bg-primary/10"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>Ver boleto</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {!contrib.lytex_invoice_id && contrib.status !== "cancelled" && contrib.status !== "paid" && contrib.status !== "awaiting_value" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary"
                      onClick={onGenerateInvoice}
                      disabled={generatingInvoice}
                    >
                      {generatingInvoice ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Gerar boleto</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onView}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Detalhes</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EmployerContributionsTab({
  contributions,
  contributionTypes = [],
  stats,
  currentClinic,
  employer,
  syncing,
  generatingInvoice,
  selectedContributionIds,
  setSelectedContributionIds,
  onSyncLytex,
  onOpenWhatsappDialog,
  onOpenEmailDialog,
  onOpenCreateDialog,
  onOpenOverdueDialog,
  onViewContribution,
  onGenerateInvoice,
  onOpenNegotiationDialog,
}: EmployerContributionsTabProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dueDateFrom, setDueDateFrom] = useState("");
  const [dueDateTo, setDueDateTo] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "list";
    const saved = window.localStorage.getItem("employerContributionsViewMode");
    return saved === "grid" ? "grid" : "list";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("employerContributionsViewMode", viewMode);
    }
  }, [viewMode]);
  const [overdueCollapsed, setOverdueCollapsed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Check if there are overdue or pending contributions for negotiation
  const hasNegotiableContributions = useMemo(() => {
    return contributions.some(c => c.status === "overdue" || c.status === "pending");
  }, [contributions]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = {
      all: contributions.length,
      paid: 0,
      pending: 0,
      overdue: 0,
      cancelled: 0,
    };
    contributions.forEach(c => {
      if (c.status === "paid") counts.paid++;
      else if (c.status === "pending" || c.status === "awaiting_value" || c.status === "processing") counts.pending++;
      else if (c.status === "overdue") counts.overdue++;
      else if (c.status === "cancelled") counts.cancelled++;
    });
    return counts;
  }, [contributions]);

  // Filter contributions by status + type + date range
  const displayContributions = useMemo(() => {
    let result = contributions;
    
    if (statusFilter !== "all") {
      if (statusFilter === "pending") {
        result = result.filter(c => c.status === "pending" || c.status === "awaiting_value" || c.status === "processing");
      } else {
        result = result.filter(c => c.status === statusFilter);
      }
    }

    if (typeFilter !== "all") {
      result = result.filter(c => c.contribution_type_id === typeFilter);
    }

    if (dueDateFrom) {
      result = result.filter(c => c.due_date >= dueDateFrom);
    }

    if (dueDateTo) {
      result = result.filter(c => c.due_date <= dueDateTo);
    }

    return result;
  }, [contributions, statusFilter, typeFilter, dueDateFrom, dueDateTo]);

  const hasActiveAdvancedFilters = typeFilter !== "all" || dueDateFrom !== "" || dueDateTo !== "";

  const clearAdvancedFilters = () => {
    setTypeFilter("all");
    setDueDateFrom("");
    setDueDateTo("");
  };

  // Separate contributions by status for display
  const { activeContributions, overdueContributions } = useMemo(() => {
    const overdue = displayContributions.filter(c => c.status === "overdue").sort(
      (a, b) => parseDateOnlyToLocalNoon(a.due_date).getTime() - parseDateOnlyToLocalNoon(b.due_date).getTime()
    );
    const active = displayContributions.filter(c => c.status !== "overdue");
    return { activeContributions: active, overdueContributions: overdue };
  }, [displayContributions]);


  // Totals of the FILTERED contributions (respect status/type/date filters)
  const filteredTotals = useMemo(() => {
    let total = 0, paid = 0, pending = 0, overdue = 0;
    displayContributions.forEach(c => {
      total += c.value;
      if (c.status === "paid") paid += (c.paid_value || c.value);
      else if (c.status === "overdue") overdue += c.value;
      else if (c.status === "pending" || c.status === "awaiting_value" || c.status === "processing") pending += c.value;
    });
    return { total, paid, pending, overdue };
  }, [displayContributions]);

  const [printing, setPrinting] = useState(false);

  // Print filtered contributions as PDF (includes company + accountant data)
  const handlePrint = async () => {
    if (displayContributions.length === 0) return;
    setPrinting(true);
    try {
      // Fetch linked accounting office (if any)
      let office: { name?: string; contact_name?: string; email?: string; phone?: string } | null = null;
      try {
        const { data } = await supabase
          .from("accounting_office_employers")
          .select("accounting_offices(name, contact_name, email, phone)")
          .eq("employer_id", employer?.id)
          .maybeSingle();
        office = (data as any)?.accounting_offices ?? null;
      } catch {
        office = null;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 30, "F");
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text("Relatório de Contribuições", pageWidth / 2, 12, { align: "center" });
      doc.setFontSize(9);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pageWidth / 2, 19, { align: "center" });
      doc.text(`${displayContributions.length} contribuição(ões) no filtro atual`, pageWidth / 2, 25, { align: "center" });

      // Company data
      doc.setTextColor(0, 0, 0);
      let y = 38;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Dados da Empresa", 14, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      y += 6;
      const empName = employer?.name || "-";
      const empCnpj = employer?.cnpj ? employer.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : "-";
      doc.text(`Empresa: ${empName}`, 14, y);
      y += 5;
      doc.text(`CNPJ: ${empCnpj}   Matrícula: ${employer?.registration_number || "-"}`, 14, y);
      y += 5;
      const contactLine = [employer?.phone && `Tel: ${employer.phone}`, employer?.email && `Email: ${employer.email}`].filter(Boolean).join("   ");
      if (contactLine) { doc.text(contactLine, 14, y); y += 5; }
      const addrLine = [employer?.address, employer?.city, employer?.state].filter(Boolean).join(", ");
      if (addrLine) { doc.text(`Endereço: ${addrLine}`, 14, y); y += 5; }

      // Accountant data (if linked)
      if (office) {
        y += 3;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Contador / Escritório Contábil", 14, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        y += 6;
        doc.text(`Escritório: ${office.name || "-"}`, 14, y);
        y += 5;
        const officeLine = [office.contact_name && `Responsável: ${office.contact_name}`, office.phone && `Tel: ${office.phone}`, office.email && `Email: ${office.email}`].filter(Boolean).join("   ");
        if (officeLine) { doc.text(officeLine, 14, y); y += 5; }
      }

      // Totals of filtered list
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(
        `Total: ${formatCurrency(filteredTotals.total)}   |   Recebido: ${formatCurrency(filteredTotals.paid)}   |   Pendente: ${formatCurrency(filteredTotals.pending)}   |   Vencido: ${formatCurrency(filteredTotals.overdue)}`,
        14, y
      );
      doc.setFont("helvetica", "normal");

      // Table
      const tableData = displayContributions.map((c, i) => [
        String(i + 1),
        c.contribution_types?.name || "-",
        formatCompetence(c.competence_month, c.competence_year),
        format(parseDateOnlyToLocalNoon(c.due_date), "dd/MM/yyyy"),
        formatCurrency(c.value),
        (STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending).label,
        c.paid_at ? format(parseDateOnlyToLocalNoon(c.paid_at), "dd/MM/yyyy") : "-",
        c.paid_value ? formatCurrency(c.paid_value) : "-",
      ]);

      autoTable(doc, {
        startY: y + 6,
        head: [["#", "Tipo", "Compet.", "Vencim.", "Valor", "Status", "Pago em", "V. Pago"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 55 },
          4: { halign: "right" },
          5: { halign: "center" },
          7: { halign: "right" },
        },
      });

      doc.save(`contribuicoes-${(employer?.name || "empresa").replace(/[^\w]+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd-HHmm")}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar o relatório em PDF");
    } finally {
      setPrinting(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedContributionIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedContributionIds(newSet);
  };

  const selectAllEligible = () => {
    const eligible = displayContributions.filter(
      c => c.lytex_invoice_id && c.status !== "paid" && c.status !== "cancelled"
    );
    const allSelected = eligible.every(c => selectedContributionIds.has(c.id));
    const newSet = new Set(selectedContributionIds);
    if (allSelected) {
      eligible.forEach(c => newSet.delete(c.id));
    } else {
      eligible.forEach(c => newSet.add(c.id));
    }
    setSelectedContributionIds(newSet);
  };

  const logoUrl = currentClinic?.logo_url ?? currentClinic?.whatsapp_header_image_url ?? null;

  return (
    <div className="space-y-4">
      {/* Status Filter Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusFilterBadge
          label="Todos"
          count={statusCounts.all}
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
          variant="default"
        />
        <StatusFilterBadge
          label="Pagos"
          count={statusCounts.paid}
          active={statusFilter === "paid"}
          onClick={() => setStatusFilter("paid")}
          variant="success"
        />
        <StatusFilterBadge
          label="Pendentes"
          count={statusCounts.pending}
          active={statusFilter === "pending"}
          onClick={() => setStatusFilter("pending")}
          variant="warning"
        />
        <StatusFilterBadge
          label="Vencidos"
          count={statusCounts.overdue}
          active={statusFilter === "overdue"}
          onClick={() => setStatusFilter("overdue")}
          variant="danger"
        />
        <StatusFilterBadge
          label="Cancelados"
          count={statusCounts.cancelled}
          active={statusFilter === "cancelled"}
          onClick={() => setStatusFilter("cancelled")}
          variant="muted"
        />
        {/* Filter toggle + view mode */}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="text-xs gap-1 h-8"
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {hasActiveAdvancedFilters && (
              <span className="ml-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">!</span>
            )}
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {contributionTypes.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de Contribuição</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {contributionTypes.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Vencimento de</Label>
                <Input
                  type="date"
                  value={dueDateFrom}
                  onChange={(e) => setDueDateFrom(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vencimento até</Label>
                <Input
                  type="date"
                  value={dueDateTo}
                  onChange={(e) => setDueDateTo(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              {hasActiveAdvancedFilters && (
                <div className="flex items-end">
                  <Button variant="ghost" size="sm" onClick={clearAdvancedFilters} className="text-xs gap-1 h-8 text-destructive hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                    Limpar
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards - 4 columns, reflect the FILTERED list */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-info/10 border-info/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <TrendingUp className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total</p>
                <p className="text-lg font-bold text-info">
                  {formatCurrency(filteredTotals.total)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-success/10 border-success/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Wallet className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Recebido</p>
                <p className="text-lg font-bold text-success">
                  {formatCurrency(filteredTotals.paid)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-warning/10 border-warning/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <CircleDollarSign className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Pendente</p>
                <p className="text-lg font-bold text-warning">
                  {formatCurrency(filteredTotals.pending)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-rose-500/10 border-rose-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Vencidos</p>
                <p className="text-lg font-bold text-rose-600">
                  {formatCurrency(filteredTotals.overdue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={(() => {
              const eligible = displayContributions.filter(
                c => c.lytex_invoice_id && c.status !== "paid" && c.status !== "cancelled"
              );
              return eligible.length > 0 && eligible.every(c => selectedContributionIds.has(c.id));
            })()}
            onCheckedChange={selectAllEligible}
            disabled={displayContributions.filter(
              c => c.lytex_invoice_id && c.status !== "paid" && c.status !== "cancelled"
            ).length === 0}
          />
          <span className="text-sm text-muted-foreground">Selecionar todos</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={printing || displayContributions.length === 0}
            title="Imprimir contribuições filtradas (PDF)"
          >
            {printing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Printer className="h-4 w-4 mr-1" />
            )}
            Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={onSyncLytex} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenWhatsappDialog}
            className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            WhatsApp
            {selectedContributionIds.size > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-emerald-100 text-emerald-700">
                {selectedContributionIds.size}
              </Badge>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenEmailDialog}
            className="text-blue-600 border-blue-300 hover:bg-blue-50"
          >
            <Mail className="h-4 w-4 mr-1" />
            Email
            {selectedContributionIds.size > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-blue-100 text-blue-700">
                {selectedContributionIds.size}
              </Badge>
            )}
          </Button>
          {onOpenNegotiationDialog && hasNegotiableContributions && (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenNegotiationDialog}
              className="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
            >
              <Handshake className="h-4 w-4 mr-1" />
              Negociar Débitos
            </Button>
          )}
          <Button size="sm" onClick={onOpenCreateDialog}>
            <Plus className="h-4 w-4 mr-1" />
            Nova
          </Button>
        </div>
      </div>

      {/* Main Contributions */}
      {activeContributions.length === 0 && overdueContributions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma contribuição encontrada</p>
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
        /* ===== LIST VIEW ===== */
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <ScrollArea className="max-h-[65vh]">
              <Table className="text-xs">
                <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur z-10">
                  <TableRow className="hover:bg-transparent border-b">
                    <TableHead className="h-8 px-2 w-8"></TableHead>
                    <TableHead className="h-8 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tipo</TableHead>
                    <TableHead className="h-8 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-[70px]">Compet.</TableHead>
                    <TableHead className="h-8 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-[86px]">Vencim.</TableHead>
                    <TableHead className="h-8 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-[150px]">Nº Título</TableHead>
                    <TableHead className="h-8 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-right w-[78px]">Valor</TableHead>
                    <TableHead className="h-8 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-[92px]">Status</TableHead>
                    <TableHead className="h-8 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-[86px]">Pago em</TableHead>
                    <TableHead className="h-8 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-right w-[78px]">V. Pago</TableHead>
                    <TableHead className="h-8 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center w-10">Ver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayContributions.map(contrib => {
                    const statusConfig = STATUS_CONFIG[contrib.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                    const StatusIcon = statusConfig.icon;
                    const isEligible = !!(contrib.lytex_invoice_id && contrib.status !== "paid" && contrib.status !== "cancelled");
                    return (
                      <TableRow key={contrib.id} className="hover:bg-muted/40 even:bg-muted/20 border-b-0">
                        <TableCell className="py-1.5 px-1.5">
                          {isEligible ? (
                            <Checkbox
                              checked={selectedContributionIds.has(contrib.id)}
                              onCheckedChange={() => toggleSelection(contrib.id)}
                              className="h-3.5 w-3.5"
                            />
                          ) : (
                            <Checkbox disabled className="opacity-20 h-3.5 w-3.5" />
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 px-1.5 font-medium truncate max-w-[220px]" title={contrib.contribution_types?.name || "-"}>
                          {contrib.contribution_types?.name || "-"}
                        </TableCell>
                        <TableCell className="py-1.5 px-1.5 text-muted-foreground">{formatCompetence(contrib.competence_month, contrib.competence_year)}</TableCell>
                        <TableCell className={`py-1.5 px-1.5 ${contrib.status === "overdue" ? "text-rose-600 font-medium" : ""}`}>
                          {format(parseDateOnlyToLocalNoon(contrib.due_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="py-1.5 px-1.5 font-mono text-[11px] text-muted-foreground truncate max-w-[150px]" title={getLytexTitleNumber(contrib) ? "Número do título gerado no boleto Lytex" : contrib.lytex_invoice_id ? "Identificador do documento na Lytex" : undefined}>
                          {getLytexTitleNumber(contrib) || (contrib.lytex_invoice_id ? `Doc: ${contrib.lytex_invoice_id.slice(-8).toUpperCase()}` : "-")}
                        </TableCell>
                        <TableCell className="py-1.5 px-1.5 text-right font-semibold tabular-nums">{formatCurrency(contrib.value)}</TableCell>
                        <TableCell className="py-1.5 px-1.5">
                          <Badge className={`${statusConfig.color} text-[10px] gap-1 h-5 px-1.5 font-medium`}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 px-1.5 text-emerald-600">
                          {contrib.paid_at ? format(parseDateOnlyToLocalNoon(contrib.paid_at), "dd/MM/yyyy") : "-"}
                        </TableCell>
                        <TableCell className="py-1.5 px-1.5 text-right text-emerald-600 font-medium tabular-nums">
                          {contrib.paid_value ? formatCurrency(contrib.paid_value) : "-"}
                        </TableCell>
                        <TableCell className="py-1.5 px-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onViewContribution(contrib)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {contrib.status !== "paid" && contrib.status !== "cancelled" && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                                onClick={() => onViewContribution(contrib)}
                                title="Editar"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}

                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ===== GRID VIEW ===== */}
          {/* Active Contributions */}
          {activeContributions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Contribuições ({activeContributions.length})
              </h3>
              <ScrollArea className="h-[400px] pr-3">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {activeContributions.map(contrib => {
                    const isEligible = !!(contrib.lytex_invoice_id && contrib.status !== "paid" && contrib.status !== "cancelled");
                    return (
                      <ContributionCard
                        key={contrib.id}
                        contrib={contrib}
                        isSelected={selectedContributionIds.has(contrib.id)}
                        isEligible={isEligible}
                        onSelect={() => toggleSelection(contrib.id)}
                        onView={() => onViewContribution(contrib)}
                        onGenerateInvoice={() => onGenerateInvoice(contrib)}
                        generatingInvoice={generatingInvoice}
                      />
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
          {/* Overdue Contributions - At Bottom, Collapsible */}
          {overdueContributions.length > 0 && statusFilter !== "overdue" && (
            <Collapsible open={!overdueCollapsed} onOpenChange={(open) => setOverdueCollapsed(!open)}>
              <Card className="border-rose-200 bg-rose-50/50 dark:bg-rose-950/20">
                <CollapsibleTrigger asChild>
                  <CardHeader className="py-3 cursor-pointer hover:bg-rose-100/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-rose-600" />
                        <CardTitle className="text-base text-rose-700">
                          Contribuições Vencidas ({overdueContributions.length})
                        </CardTitle>
                        <Badge className="bg-rose-200 text-rose-800 text-xs">
                          {formatCurrency(overdueContributions.reduce((acc, c) => acc + c.value, 0))}
                        </Badge>
                      </div>
                      {overdueCollapsed ? (
                        <ChevronDown className="h-5 w-5 text-rose-600" />
                      ) : (
                        <ChevronUp className="h-5 w-5 text-rose-600" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {overdueContributions.length > 6 && (
                      <div className="text-xs text-rose-500 mb-2 flex items-center gap-1">
                        <span>↕</span>
                        <span>Role para ver todas as {overdueContributions.length} contribuições</span>
                      </div>
                    )}
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pb-2">
                        {overdueContributions.map(contrib => {
                          const isEligible = !!(contrib.lytex_invoice_id && contrib.status !== "paid" && contrib.status !== "cancelled");
                          return (
                            <ContributionCard
                              key={contrib.id}
                              contrib={contrib}
                              isSelected={selectedContributionIds.has(contrib.id)}
                              isEligible={isEligible}
                              onSelect={() => toggleSelection(contrib.id)}
                              onView={() => onViewContribution(contrib)}
                              onGenerateInvoice={() => onGenerateInvoice(contrib)}
                              generatingInvoice={generatingInvoice}
                            />
                          );
                        })}
                      </div>
                    </ScrollArea>
                    <div className="mt-3 pt-3 border-t border-rose-200 flex items-center justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-rose-600 border-rose-300 hover:bg-rose-100"
                        onClick={onOpenOverdueDialog}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Cobrar via WhatsApp
                      </Button>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* When filtering by overdue, show all in grid */}
          {overdueContributions.length > 0 && statusFilter === "overdue" && (
            <div>
              <h3 className="text-sm font-medium text-rose-600 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Contribuições Vencidas ({overdueContributions.length})
                <Badge className="bg-rose-200 text-rose-800 text-xs ml-2">
                  {formatCurrency(overdueContributions.reduce((acc, c) => acc + c.value, 0))}
                </Badge>
              </h3>
              <ScrollArea className="h-[500px] pr-3">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {overdueContributions.map(contrib => {
                    const isEligible = !!(contrib.lytex_invoice_id && contrib.status !== "paid" && contrib.status !== "cancelled");
                    return (
                      <ContributionCard
                        key={contrib.id}
                        contrib={contrib}
                        isSelected={selectedContributionIds.has(contrib.id)}
                        isEligible={isEligible}
                        onSelect={() => toggleSelection(contrib.id)}
                        onView={() => onViewContribution(contrib)}
                        onGenerateInvoice={() => onGenerateInvoice(contrib)}
                        generatingInvoice={generatingInvoice}
                      />
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="mt-3 flex items-center justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-rose-600 border-rose-300 hover:bg-rose-100"
                  onClick={onOpenOverdueDialog}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Cobrar via WhatsApp
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Negotiation Installments Section */}
      <NegotiationInstallmentsSection employerId={employer?.id} clinicId={currentClinic?.id} />
    </div>
  );
}

// ===== Negotiation Installments Section =====

interface NegotiationInstallment {
  id: string;
  installment_number: number;
  value: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  paid_value: number | null;
  lytex_invoice_url: string | null;
  negotiation: {
    id: string;
    negotiation_code: string;
  };
}

function NegotiationInstallmentsSection({ employerId, clinicId }: { employerId?: string; clinicId?: string }) {
  const [installments, setInstallments] = useState<NegotiationInstallment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employerId || !clinicId) return;

    const fetchInstallments = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("negotiation_installments")
          .select(`
            id, installment_number, value, due_date, status, paid_at, paid_value, lytex_invoice_url,
            negotiation:debt_negotiations!inner (id, negotiation_code, clinic_id, employer_id)
          `)
          .eq("negotiation.clinic_id", clinicId)
          .eq("negotiation.employer_id", employerId)
          .order("due_date", { ascending: true });

        if (!error && data) {
          setInstallments(data as unknown as NegotiationInstallment[]);
        }
      } catch (err) {
        console.error("Error fetching installments:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInstallments();
  }, [employerId, clinicId]);

  if (loading) return null;
  if (installments.length === 0) return null;

  const paid = installments.filter(i => i.status === "paid");
  const overdue = installments.filter(i => i.status === "overdue");
  const pending = installments.filter(i => i.status === "pending");
  const totalValue = installments.reduce((acc, i) => acc + i.value, 0);
  const paidValue = paid.reduce((acc, i) => acc + (i.paid_value || i.value), 0);

  const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    paid: { label: "Pago", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800", icon: CheckCircle2 },
    pending: { label: "Pendente", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800", icon: Clock },
    overdue: { label: "Vencido", color: "bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800", icon: AlertTriangle },
    cancelled: { label: "Cancelado", color: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700", icon: XCircle },
  };

  // Group by negotiation
  const byNegotiation = installments.reduce((acc, inst) => {
    const code = inst.negotiation.negotiation_code;
    if (!acc[code]) acc[code] = [];
    acc[code].push(inst);
    return acc;
  }, {} as Record<string, NegotiationInstallment[]>);

  return (
    <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Handshake className="h-5 w-5 text-indigo-600" />
          <CardTitle className="text-base">Parcelas de Negociação</CardTitle>
        </div>
        <CardDescription>
          {paid.length} paga(s) • {pending.length} pendente(s) • {overdue.length} vencida(s) — Total: {formatCurrency(totalValue * 100)} | Recebido: {formatCurrency(paidValue * 100)}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {Object.entries(byNegotiation).map(([code, items]) => (
          <div key={code} className="mb-4 last:mb-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-600 font-mono text-xs">
                {code}
              </Badge>
              <span className="text-xs text-muted-foreground">{items.length} parcela(s)</span>
            </div>
            <ScrollArea className={items.length > 6 ? "h-[250px]" : ""}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-16">#</TableHead>
                    <TableHead className="text-xs">Vencimento</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Pagamento</TableHead>
                    <TableHead className="text-xs text-right">Valor Pago</TableHead>
                    <TableHead className="text-xs text-center w-12">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(inst => {
                    const sc = statusConfig[inst.status] || statusConfig.pending;
                    const StatusIcon = sc.icon;
                    return (
                      <TableRow key={inst.id}>
                        <TableCell className="py-1.5 text-sm font-mono">
                          {inst.installment_number === 0 ? "Entrada" : `P.${inst.installment_number}`}
                        </TableCell>
                        <TableCell className={`py-1.5 text-sm ${inst.status === "overdue" ? "text-rose-600 font-medium" : ""}`}>
                          {format(parseDateOnlyToLocalNoon(inst.due_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="py-1.5 text-sm text-right font-medium">
                          {formatCurrency(inst.value * 100)}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge className={`${sc.color} text-[10px] gap-0.5 h-5`}>
                            <StatusIcon className="h-3 w-3" />
                            {sc.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-sm text-emerald-600">
                          {inst.paid_at ? format(parseDateOnlyToLocalNoon(inst.paid_at), "dd/MM/yyyy") : "—"}
                        </TableCell>
                        <TableCell className="py-1.5 text-sm text-right text-emerald-600 font-medium">
                          {inst.paid_value ? formatCurrency(inst.paid_value * 100) : "—"}
                        </TableCell>
                        <TableCell className="py-1.5 text-center">
                          {inst.lytex_invoice_url && (
                            <a href={inst.lytex_invoice_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                              <ExternalLink className="h-4 w-4 inline" />
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
