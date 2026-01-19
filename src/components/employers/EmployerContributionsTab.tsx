import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { format } from "date-fns";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import { EmployerContributionFilters } from "@/components/contributions/EmployerContributionFilters";

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

interface EmployerContributionsTabProps {
  contributions: Contribution[];
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
}

function formatCompetence(month: number, year: number): string {
  return `${String(month).padStart(2, "0")}/${year}`;
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
            {contrib.lytex_invoice_id ? (
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
}: EmployerContributionsTabProps) {
  const [filteredContributions, setFilteredContributions] = useState<Contribution[]>([]);
  const [overdueCollapsed, setOverdueCollapsed] = useState(false);

  const displayContributions = filteredContributions.length > 0 ? filteredContributions : contributions;

  // Separate contributions by status
  const { activeContributions, overdueContributions } = useMemo(() => {
    const overdue = displayContributions.filter(c => c.status === "overdue").sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );
    const active = displayContributions.filter(c => c.status !== "overdue");
    return { activeContributions: active, overdueContributions: overdue };
  }, [displayContributions]);

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
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total {new Date().getFullYear()}</p>
            <p className="text-xl font-bold">{stats.yearTotal}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats.totalValue)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Pagos</p>
            <p className="text-xl font-bold text-emerald-600">{stats.paid}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats.paidValue)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <p className="text-xl font-bold text-amber-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Vencidos</p>
            <p className="text-xl font-bold text-rose-600">{stats.overdue}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500 col-span-2 sm:col-span-1">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Histórico Total</p>
            <p className="text-xl font-bold text-blue-600">{stats.total}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <EmployerContributionFilters
        contributions={contributions}
        onFilterChange={setFilteredContributions}
        onSendOverdueWhatsApp={onOpenOverdueDialog}
        employerName={employer?.name || ""}
        employerCnpj={employer?.cnpj || ""}
        clinicInfo={currentClinic ? {
          name: currentClinic.name,
          cnpj: currentClinic.cnpj,
          phone: currentClinic.phone,
          address: currentClinic.address,
          logoUrl,
        } : undefined}
      />

      {/* Actions */}
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
          <Button size="sm" onClick={onOpenCreateDialog}>
            <Plus className="h-4 w-4 mr-1" />
            Nova
          </Button>
        </div>
      </div>

      {/* Main Contributions Grid */}
      {activeContributions.length === 0 && overdueContributions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma contribuição encontrada</p>
          </CardContent>
        </Card>
      ) : (
        <>
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
          {overdueContributions.length > 0 && (
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
                    <ScrollArea className="max-h-[300px] pr-3">
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
        </>
      )}
    </div>
  );
}
