import { useMemo, useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Search,
  DollarSign,
  ExternalLink,
  Loader2,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Handshake,
  Calendar
} from "lucide-react";

interface Contribution {
  id: string;
  employer_id?: string;
  competence_month: number;
  competence_year: number;
  due_date: string;
  value?: number;
  amount?: number;
  status: string;
  paid_at?: string | null;
  paid_value?: number | null;
  lytex_invoice_url?: string;
  lytex_url?: string | null;
  lytex_invoice_id?: string | null;
  portal_reissue_count?: number;
  negotiation_id?: string | null;
  negotiation?: {
    id: string;
    negotiation_code: string;
    status: string;
    installments_count: number;
  } | null;
  employer?: {
    id: string;
    name: string;
    cnpj: string;
    registration_number?: string | null;
  };
  contribution_type?: {
    name: string;
  } | null;
}

interface PortalContributionsListProps {
  contributions: Contribution[];
  isLoading: boolean;
  showEmployerInfo?: boolean;
  filterEmployerId?: string;
  onReissue: (contribution: Contribution) => void;
  onSetValue: (contribution: Contribution) => void;
  onGenerateInvoice?: (contribution: Contribution) => void;
  generatingInvoiceId?: string | null;
  onClearEmployerFilter?: () => void;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  pending: { 
    label: "Pendente", 
    color: "text-amber-700", 
    bgColor: "bg-amber-50 border-amber-200",
    icon: <Clock className="h-3.5 w-3.5" />
  },
  paid: { 
    label: "Pago", 
    color: "text-emerald-700", 
    bgColor: "bg-emerald-50 border-emerald-200",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />
  },
  overdue: { 
    label: "Vencido", 
    color: "text-red-700", 
    bgColor: "bg-red-50 border-red-200",
    icon: <AlertCircle className="h-3.5 w-3.5" />
  },
  cancelled: { 
    label: "Cancelado", 
    color: "text-slate-500", 
    bgColor: "bg-slate-50 border-slate-200",
    icon: <XCircle className="h-3.5 w-3.5" />
  },
  awaiting_value: { 
    label: "Aguardando Valor", 
    color: "text-purple-700", 
    bgColor: "bg-purple-50 border-purple-200",
    icon: <DollarSign className="h-3.5 w-3.5" />
  },
  negotiated: { 
    label: "Em Negociação", 
    color: "text-indigo-700", 
    bgColor: "bg-indigo-50 border-indigo-200",
    icon: <Handshake className="h-3.5 w-3.5" />
  },
};

export function PortalContributionsList({
  contributions,
  isLoading,
  showEmployerInfo = false,
  filterEmployerId,
  onReissue,
  onSetValue,
  onGenerateInvoice,
  generatingInvoiceId,
  onClearEmployerFilter
}: PortalContributionsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const formatCurrency = (valueInCents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format((valueInCents || 0) / 100);
  };

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return "";
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const parseISODateToLocalNoon = (isoDate: string) => {
    const [y, m, d] = isoDate.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
  };

  // Filter by tab, employer and search
  const filteredContributions = useMemo(() => {
    return contributions.filter(c => {
      // Employer filter (external)
      if (filterEmployerId && c.employer_id !== filterEmployerId) return false;

      // Tab filter
      if (activeTab === "pending" && c.status !== "pending") return false;
      if (activeTab === "overdue" && c.status !== "overdue") return false;
      if (activeTab === "paid" && c.status !== "paid") return false;
      if (activeTab === "awaiting" && c.status !== "awaiting_value") return false;
      if (activeTab === "all" && c.status === "cancelled") return false;

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const employerName = c.employer?.name?.toLowerCase() || "";
        const employerCnpj = c.employer?.cnpj?.replace(/\D/g, "") || "";
        const typeName = c.contribution_type?.name?.toLowerCase() || "";
        const searchNormalized = searchTerm.replace(/\D/g, "");
        
        if (!employerName.includes(term) && 
            !employerCnpj.includes(searchNormalized) && 
            !typeName.includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [contributions, activeTab, searchTerm, filterEmployerId]);

  // Group by competence
  const groupedContributions = useMemo(() => {
    const groups: Record<string, Contribution[]> = {};
    
    filteredContributions.forEach(c => {
      const key = `${c.competence_year}-${String(c.competence_month).padStart(2, "0")}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });

    // Sort groups by date (newest first)
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, items]) => {
        const [year, month] = key.split("-");
        return {
          key,
          label: `${MONTHS[parseInt(month) - 1]} ${year}`,
          year: parseInt(year),
          month: parseInt(month),
          items,
          totalValue: items.reduce((sum, i) => sum + (i.value || i.amount || 0), 0),
          paidCount: items.filter(i => i.status === "paid").length,
          pendingCount: items.filter(i => i.status === "pending" || i.status === "overdue").length,
        };
      });
  }, [filteredContributions]);

  // Auto-expand first 2 groups on initial load
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (groupedContributions.length > 0 && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const initial = new Set(groupedContributions.slice(0, 2).map(g => g.key));
      setExpandedGroups(initial);
    }
    // Only run once on mount, not on every groupedContributions change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedContributions.length]);

  const setGroupOpen = (key: string, open: boolean) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const stats = useMemo(() => ({
    pending: contributions.filter(c => c.status === "pending").length,
    overdue: contributions.filter(c => c.status === "overdue").length,
    paid: contributions.filter(c => c.status === "paid").length,
    awaiting: contributions.filter(c => c.status === "awaiting_value").length,
  }), [contributions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
      </div>
    );
  }

  // Get filtered employer name for display
  const filteredEmployerName = useMemo(() => {
    if (!filterEmployerId) return null;
    const emp = contributions.find(c => c.employer_id === filterEmployerId)?.employer;
    return emp?.name || emp?.cnpj;
  }, [filterEmployerId, contributions]);

  return (
    <div className="space-y-4">
      {/* Employer Filter Indicator */}
      {filteredEmployerName && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm text-blue-700">
            Filtrando por: <strong>{filteredEmployerName}</strong>
          </span>
          {onClearEmployerFilter && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearEmployerFilter}
              className="h-6 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
            >
              Limpar filtro
            </Button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder={showEmployerInfo ? "Buscar por empresa, CNPJ ou tipo..." : "Buscar por tipo de contribuição..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-10 bg-white border-slate-200"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start bg-white border border-slate-200 p-1 h-auto flex-wrap">
          <TabsTrigger 
            value="all" 
            className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-4 py-2"
          >
            Todas
          </TabsTrigger>
          <TabsTrigger 
            value="pending" 
            className="data-[state=active]:bg-amber-500 data-[state=active]:text-white rounded-lg px-4 py-2"
          >
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            Pendentes
            {stats.pending > 0 && (
              <Badge className="ml-1.5 bg-amber-100 text-amber-700 h-5 px-1.5">{stats.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="overdue" 
            className="data-[state=active]:bg-red-500 data-[state=active]:text-white rounded-lg px-4 py-2"
          >
            <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
            Vencidas
            {stats.overdue > 0 && (
              <Badge className="ml-1.5 bg-red-100 text-red-700 h-5 px-1.5">{stats.overdue}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="paid" 
            className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white rounded-lg px-4 py-2"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Pagas
          </TabsTrigger>
          <TabsTrigger 
            value="awaiting" 
            className="data-[state=active]:bg-purple-500 data-[state=active]:text-white rounded-lg px-4 py-2"
          >
            <DollarSign className="h-3.5 w-3.5 mr-1.5" />
            Aguardando
            {stats.awaiting > 0 && (
              <Badge className="ml-1.5 bg-purple-100 text-purple-700 h-5 px-1.5">{stats.awaiting}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredContributions.length === 0 ? (
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-3 text-slate-200" />
                <p className="text-slate-500">Nenhuma contribuição encontrada</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {groupedContributions.map((group) => (
                <Collapsible
                  key={group.key}
                  open={expandedGroups.has(group.key)}
                  onOpenChange={(open) => setGroupOpen(group.key, open)}
                >
                  <Card className="bg-white border-0 shadow-sm overflow-hidden">
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="py-3 px-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                              <Calendar className="h-5 w-5 text-slate-600" />
                            </div>
                            <div className="text-left">
                              <CardTitle className="text-base font-semibold text-slate-800">
                                {group.label}
                              </CardTitle>
                              <p className="text-xs text-slate-500">
                                {group.items.length} contribuição(ões) • {formatCurrency(group.totalValue)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="hidden sm:flex items-center gap-2">
                              {group.pendingCount > 0 && (
                                <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">
                                  {group.pendingCount} pendente(s)
                                </Badge>
                              )}
                              {group.paidCount > 0 && (
                                <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">
                                  {group.paidCount} pago(s)
                                </Badge>
                              )}
                            </div>
                            <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${expandedGroups.has(group.key) ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <CardContent className="pt-0 pb-3 px-3">
                        <div className="grid gap-2">
                          {group.items.map((contrib) => (
                            <ContributionCard
                              key={contrib.id}
                              contribution={contrib}
                              showEmployerInfo={showEmployerInfo}
                              onReissue={onReissue}
                              onSetValue={onSetValue}
                              onGenerateInvoice={onGenerateInvoice}
                              generatingInvoiceId={generatingInvoiceId}
                              formatCurrency={formatCurrency}
                              formatCNPJ={formatCNPJ}
                              parseISODateToLocalNoon={parseISODateToLocalNoon}
                            />
                          ))}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ContributionCardProps {
  contribution: Contribution;
  showEmployerInfo: boolean;
  onReissue: (contribution: Contribution) => void;
  onSetValue: (contribution: Contribution) => void;
  onGenerateInvoice?: (contribution: Contribution) => void;
  generatingInvoiceId?: string | null;
  formatCurrency: (value: number) => string;
  formatCNPJ: (cnpj: string) => string;
  parseISODateToLocalNoon: (date: string) => Date;
}

function ContributionCard({
  contribution: contrib,
  showEmployerInfo,
  onReissue,
  onSetValue,
  onGenerateInvoice,
  generatingInvoiceId,
  formatCurrency,
  formatCNPJ,
  parseISODateToLocalNoon
}: ContributionCardProps) {
  const dueDate = contrib.due_date ? parseISODateToLocalNoon(contrib.due_date) : new Date();
  const today = new Date();
  const daysDiff = contrib.due_date ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const isOverdue90Days = daysDiff > 90;
  const reissueCount = contrib.portal_reissue_count || 0;
  const reissueLimitReached = reissueCount >= 2;
  const statusConfig = STATUS_CONFIG[contrib.status] || STATUS_CONFIG.pending;
  const value = contrib.value || contrib.amount || 0;
  const invoiceUrl = contrib.lytex_invoice_url || contrib.lytex_url;
  
  const isInActiveNegotiation = contrib.negotiation_id && 
    contrib.negotiation && 
    ['active', 'approved', 'pending_approval'].includes(contrib.negotiation.status);

  const needsInvoice = !invoiceUrl && 
    contrib.status !== "paid" && 
    contrib.status !== "cancelled" && 
    contrib.status !== "awaiting_value" &&
    value > 0;

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors gap-3">
      {/* Left: Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {showEmployerInfo && (
            <span className="font-medium text-slate-900 text-sm truncate max-w-[200px]">
              {contrib.employer?.name || "-"}
            </span>
          )}
          <span className="text-sm text-slate-600">
            {contrib.contribution_type?.name || "Contribuição"}
          </span>
          <Badge 
            variant="outline" 
            className={`${statusConfig.bgColor} ${statusConfig.color} border text-xs px-2 py-0 h-5 gap-1`}
          >
            {statusConfig.icon}
            {statusConfig.label}
          </Badge>
          {isInActiveNegotiation && (
            <Badge 
              variant="outline" 
              className="bg-indigo-50 border-indigo-200 text-indigo-700 text-xs px-2 py-0 h-5"
            >
              <Handshake className="h-3 w-3 mr-1" />
              {contrib.negotiation?.installments_count}x
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
          {showEmployerInfo && contrib.employer?.cnpj && (
            <>
              <span className="font-mono">{formatCNPJ(contrib.employer.cnpj)}</span>
              <span>•</span>
            </>
          )}
          <span className={contrib.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
            Venc: {contrib.due_date ? dueDate.toLocaleDateString("pt-BR") : "-"}
          </span>
          {contrib.status === "paid" && contrib.paid_at && (
            <>
              <span>•</span>
              <span className="text-emerald-600 font-medium">
                Pago: {new Date(contrib.paid_at).toLocaleDateString("pt-BR")}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Center: Value */}
      <div className="text-right">
        <p className="font-semibold text-slate-900">{formatCurrency(value)}</p>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {invoiceUrl && contrib.status !== "paid" && contrib.status !== "cancelled" && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 border-slate-200"
                  onClick={() => window.open(invoiceUrl, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Abrir boleto</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {needsInvoice && onGenerateInvoice && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => onGenerateInvoice(contrib)}
                  disabled={generatingInvoiceId === contrib.id}
                >
                  {generatingInvoiceId === contrib.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      Boleto
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Gerar boleto</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        {!isInActiveNegotiation && contrib.status === 'overdue' && !isOverdue90Days && !reissueLimitReached && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs hover:bg-amber-50 hover:text-amber-700"
                  onClick={() => onReissue(contrib)}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  2ª Via
                </Button>
              </TooltipTrigger>
              <TooltipContent>Gerar nova via com nova data</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        {contrib.status === "awaiting_value" && (
          <Button
            size="sm"
            className="h-8 px-3 text-xs bg-purple-600 hover:bg-purple-700"
            onClick={() => onSetValue(contrib)}
          >
            <DollarSign className="h-3.5 w-3.5 mr-1" />
            Definir
          </Button>
        )}
      </div>
    </div>
  );
}
