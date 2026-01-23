import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Eye,
  Plus,
  ExternalLink,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ChevronDown,
  FileStack,
  Zap,
  CloudDownload,
  FileBarChart,
  DollarSign,
  LayoutDashboard,
  List,
  MessageCircle,
  Mail,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSessionValidator } from "@/hooks/useSessionValidator";
import { toast } from "sonner";
import { extractFunctionsError } from "@/lib/functionsError";
import { formatCompetence } from "@/lib/competence-format";
import { getStaticYearRange } from "@/hooks/useAvailableYears";
import PFContributionDialog from "@/components/contributions/PFContributionDialog";
import PFBatchContributionDialog from "@/components/contributions/PFBatchContributionDialog";
import PFContributionDetailDialog from "@/components/contributions/PFContributionDetailDialog";
import { BatchGenerateLytexDialog } from "@/components/contributions/BatchGenerateLytexDialog";
import { LytexSyncStatusIndicator } from "@/components/contributions/LytexSyncStatusIndicator";
import { LytexConciliationHistoryDialog } from "@/components/contributions/LytexConciliationHistoryDialog";
import PFContributionsReportsTab from "@/components/contributions/PFContributionsReportsTab";
import { SendPFContributionWhatsAppDialog } from "@/components/contributions/SendPFContributionWhatsAppDialog";
import { SendPFContributionEmailDialog } from "@/components/contributions/SendPFContributionEmailDialog";

interface Member {
  id: string;
  name: string;
  cpf: string | null;
  email?: string | null;
  phone?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
  description: string | null;
  default_value: number;
  is_active: boolean;
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
  lytex_invoice_id: string | null;
  lytex_invoice_url: string | null;
  lytex_boleto_digitable_line: string | null;
  lytex_pix_code: string | null;
  lytex_pix_qrcode: string | null;
  paid_at: string | null;
  paid_value: number | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  member_id?: string | null;
  patients?: Member;
  contribution_types?: ContributionType;
}

const ITEMS_PER_PAGE = 15;

const STATUS_CONFIG = {
  pending: {
    label: "Pendente",
    badgeClass: "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-600",
    rowClass: "border-l-4 border-l-amber-400",
    icon: Clock,
  },
  processing: {
    label: "Processando",
    badgeClass: "bg-blue-500/15 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-600",
    rowClass: "border-l-4 border-l-blue-400",
    icon: RefreshCw,
  },
  paid: {
    label: "Pago",
    badgeClass: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-600",
    rowClass: "border-l-4 border-l-emerald-500",
    icon: CheckCircle2,
  },
  overdue: {
    label: "Vencido",
    badgeClass: "bg-rose-500/15 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-600",
    rowClass: "border-l-4 border-l-rose-500",
    icon: AlertTriangle,
  },
  cancelled: {
    label: "Cancelado",
    badgeClass: "bg-gray-500/10 text-gray-500 border-gray-300 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-600 line-through",
    rowClass: "border-l-4 border-l-gray-300 opacity-60",
    icon: XCircle,
  },
};

export default function MemberContributionsTab() {
  const { currentClinic, session, user } = useAuth();
  const { validateSession } = useSessionValidator();
  
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [contributionTypes, setContributionTypes] = useState<ContributionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fetchingPaid, setFetchingPaid] = useState(false);
  const [importingExternal, setImportingExternal] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("hide_cancelled");
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("list");
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [batchGenerateLytexOpen, setBatchGenerateLytexOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [sendingContribution, setSendingContribution] = useState<Contribution | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentClinic) return;
    setLoading(true);

    try {
      // Fetch PF contributions (with member_id)
      const { data: contribData, error: contribError } = await supabase
        .from("employer_contributions")
        .select(`
          *,
          patients:member_id (id, name, cpf, email, phone),
          contribution_types (id, name, description, default_value, is_active)
        `)
        .eq("clinic_id", currentClinic.id)
        .eq("competence_year", yearFilter)
        .not("member_id", "is", null)
        .order("competence_month", { ascending: false })
        .order("created_at", { ascending: false });

      if (contribError) throw contribError;
      setContributions(contribData || []);

      // Fetch contribution types
      const { data: typesData, error: typesError } = await supabase
        .from("contribution_types")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("name");

      if (typesError) throw typesError;
      setContributionTypes(typesData || []);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar contribuições");
    } finally {
      setLoading(false);
    }
  }, [currentClinic, yearFilter]);

  useEffect(() => {
    if (currentClinic) {
      fetchData();
    }
  }, [currentClinic, yearFilter, fetchData]);

  const handleViewContribution = (contribution: Contribution) => {
    setSelectedContribution(contribution);
    setViewDialogOpen(true);
  };

  const handleGenerateInvoice = async (contribution: Contribution) => {
    if (!contribution.patients) {
      toast.error("Dados do contribuinte não encontrados");
      return;
    }
    if (!contribution.patients.cpf) {
      toast.error("CPF do contribuinte não informado");
      return;
    }

    const isSessionValid = await validateSession();
    if (!isSessionValid) return;

    setGeneratingInvoice(true);
    try {
      const body = {
        action: "create_invoice",
        contributionId: contribution.id,
        clinicId: currentClinic?.id,
        value: contribution.value,
        dueDate: contribution.due_date,
        description: `${contribution.contribution_types?.name || "Contribuição"} - ${formatCompetence(contribution.competence_month, contribution.competence_year)}`,
        enableBoleto: true,
        enablePix: true,
        member: {
          cpf: contribution.patients.cpf,
          name: contribution.patients.name,
          email: contribution.patients.email,
          phone: contribution.patients.phone,
        },
      };

      const response = await supabase.functions.invoke("lytex-api", { body });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success("Boleto gerado com sucesso!");
      setViewDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Error generating invoice:", error);
      toast.error(`Erro ao gerar boleto: ${errorMessage}`);
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const handleSyncAll = async () => {
    if (!currentClinic) return;
    
    const isSessionValid = await validateSession();
    if (!isSessionValid) return;
    
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("lytex-api", {
        body: {
          action: "sync_all_pending",
          clinicId: currentClinic.id,
          onlyPF: true,
        },
      });

      if (error) {
        const { message } = extractFunctionsError(error);
        throw new Error(message);
      }

      if (data?.updated > 0) {
        toast.success(`${data.updated} contribuição(ões) atualizada(s)`);
        fetchData();
      } else {
        toast.info("Nenhuma atualização encontrada");
      }
    } catch (error: unknown) {
      const { message } = extractFunctionsError(error);
      console.error("Error syncing:", error);
      toast.error(`Erro ao sincronizar: ${message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleFetchPaidInvoices = async () => {
    if (!currentClinic) return;
    
    const isSessionValid = await validateSession();
    if (!isSessionValid) return;
    
    setFetchingPaid(true);
    try {
      const { data, error } = await supabase.functions.invoke("lytex-api", {
        body: {
          action: "fetch_paid_invoices",
          clinicId: currentClinic.id,
          mode: "manual",
          daysBack: null,
          onlyPending: true,
          onlyPF: true,
        },
      });

      if (error) throw error;

      if (data?.conciliated > 0) {
        toast.success(`${data.conciliated} boleto(s) conciliado(s) automaticamente!`);
        fetchData();
      } else if (data?.alreadyConciliated > 0 && data?.pendingInLytex > 0) {
        toast.info(`${data.alreadyConciliated} já conciliados, ${data.pendingInLytex} ainda pendentes na Lytex`);
      } else if (data?.alreadyConciliated > 0) {
        toast.info(`Todos os ${data.alreadyConciliated} boletos pagos já estavam conciliados`);
      } else if (data?.pendingInLytex > 0) {
        toast.info(`${data.pendingInLytex} boleto(s) ainda pendente(s) na Lytex (não pagos)`);
      } else {
        toast.info("Nenhum boleto pago encontrado para conciliar");
      }

      console.log("Busca de pagamentos PF:", data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Error fetching paid invoices:", error);
      toast.error(`Erro ao buscar pagamentos: ${errorMessage}`);
    } finally {
      setFetchingPaid(false);
    }
  };

  const handleImportExternalPaidInvoices = async () => {
    if (!currentClinic) return;
    
    const isSessionValid = await validateSession();
    if (!isSessionValid) return;
    
    setImportingExternal(true);
    try {
      toast.info("Buscando faturas pagas de todas as integrações Lytex...");
      
      const { data, error } = await supabase.functions.invoke("lytex-api", {
        body: {
          action: "import_external_paid_invoices",
          clinicId: currentClinic.id,
          onlyPF: true,
        },
      });

      if (error) throw error;

      if (data?.imported > 0) {
        toast.success(`${data.imported} boleto(s) externo(s) importado(s) automaticamente!`);
        fetchData();
      } else if (data?.alreadyExists > 0) {
        toast.info(`Todas as ${data.alreadyExists} faturas já existiam no banco`);
      } else {
        toast.info("Nenhuma fatura externa encontrada para importar");
      }

      console.log("Importação externa PF:", data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Error importing external invoices:", error);
      toast.error(`Erro ao importar faturas externas: ${errorMessage}`);
    } finally {
      setImportingExternal(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const formatCPF = (cpf: string | null) => {
    if (!cpf) return "-";
    const clean = cpf.replace(/\D/g, "");
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const filteredContributions = useMemo(() => {
    return contributions.filter((c) => {
      let matchesSearch = true;
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase().trim();
        const searchClean = searchTerm.replace(/\D/g, "");
        const memberNameMatch = c.patients?.name?.toLowerCase().includes(searchLower);
        const cpfClean = c.patients?.cpf?.replace(/\D/g, "") || "";
        const cpfMatch = searchClean.length >= 3 && cpfClean.includes(searchClean);
        const typeMatch = c.contribution_types?.name?.toLowerCase().includes(searchLower);
        matchesSearch = !!(memberNameMatch || cpfMatch || typeMatch);
      }
      
      const matchesStatus = statusFilter === "all" || (statusFilter === "hide_cancelled" ? c.status !== "cancelled" : c.status === statusFilter);
      return matchesSearch && matchesStatus;
    });
  }, [contributions, searchTerm, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = contributions.length;
    const paid = contributions.filter(c => c.status === "paid").length;
    const pending = contributions.filter(c => c.status === "pending").length;
    const overdue = contributions.filter(c => c.status === "overdue").length;
    const totalValue = contributions.reduce((acc, c) => acc + (c.value || 0), 0);
    const paidValue = contributions.filter(c => c.status === "paid").reduce((acc, c) => acc + (c.paid_value || c.value || 0), 0);
    
    return { total, paid, pending, overdue, totalValue, paidValue };
  }, [contributions]);

  const totalPages = Math.ceil(filteredContributions.length / ITEMS_PER_PAGE);
  const paginatedContributions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredContributions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredContributions, currentPage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Contribuições PF
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie boletos e contribuições dos sócios pessoa física
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Contribuição
          </Button>
          <Button variant="outline" onClick={() => setBatchDialogOpen(true)} className="gap-2">
            <FileStack className="h-4 w-4" />
            Gerar em Lote
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                disabled={syncing || fetchingPaid || importingExternal}
              >
                {syncing || fetchingPaid || importingExternal ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Lytex
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleSyncAll} disabled={syncing}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sincronizar Status
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setBatchGenerateLytexOpen(true)} className="text-amber-600">
                <Zap className="h-4 w-4 mr-2" />
                Gerar Boletos Pendentes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleFetchPaidInvoices} disabled={fetchingPaid} className="text-green-600">
                <Receipt className="h-4 w-4 mr-2" />
                Buscar Pagamentos (Conciliação)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleImportExternalPaidInvoices} disabled={importingExternal} className="text-blue-600">
                <CloudDownload className="h-4 w-4 mr-2" />
                Importar Boletos Externos Pagos
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setHistoryDialogOpen(true)}>
                <FileBarChart className="h-4 w-4 mr-2" />
                Histórico de Sincronização
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Lytex Sync Status */}
      {currentClinic && (
        <LytexSyncStatusIndicator
          clinicId={currentClinic.id}
          onSyncClick={handleSyncAll}
          syncing={syncing}
        />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Lista</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <FileBarChart className="h-4 w-4" />
            <span className="hidden sm:inline">Relatórios</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Receipt className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Pagos</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stats.paid}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-amber-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Pendentes</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.pending}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-rose-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Vencidos</p>
                    <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">{stats.overdue}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Previsto</p>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{formatCurrency(stats.totalValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Recebido</p>
                    <p className="text-lg font-bold text-green-700 dark:text-green-400">{formatCurrency(stats.paidValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* List Tab */}
        <TabsContent value="list">
          {/* Filters */}
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, CPF ou tipo..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                  />
                </div>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="hide_cancelled">Ocultar cancelados</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="paid">Pagos</SelectItem>
                    <SelectItem value="overdue">Vencidos</SelectItem>
                    <SelectItem value="cancelled">Cancelados</SelectItem>
                  </SelectContent>
                </Select>

                {/* Year Filter */}
                <Select value={yearFilter.toString()} onValueChange={(v) => setYearFilter(parseInt(v))}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {getStaticYearRange().map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sócio</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedContributions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        <Receipt className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p>Nenhuma contribuição encontrada</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedContributions.map((contribution) => {
                      const status = STATUS_CONFIG[contribution.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                      const StatusIcon = status.icon;
                      
                      return (
                        <TableRow key={contribution.id} className={status.rowClass}>
                          <TableCell className="font-medium">
                            {contribution.patients?.name || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatCPF(contribution.patients?.cpf || null)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal">
                              {contribution.contribution_types?.name || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatCompetence(contribution.competence_month, contribution.competence_year)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(contribution.value)}
                          </TableCell>
                          <TableCell>
                            {format(new Date(contribution.due_date + "T12:00:00"), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            <Badge className={status.badgeClass}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleViewContribution(contribution)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ver detalhes</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              {contribution.lytex_invoice_url && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => window.open(contribution.lytex_invoice_url!, "_blank")}
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Abrir boleto</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}

                              {contribution.lytex_boleto_digitable_line && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => copyToClipboard(contribution.lytex_boleto_digitable_line!, "Linha digitável")}
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Copiar linha digitável</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}

                              {!contribution.lytex_invoice_id && contribution.status !== "paid" && contribution.status !== "cancelled" && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleGenerateInvoice(contribution)}
                                        disabled={generatingInvoice}
                                      >
                                        {generatingInvoice ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Receipt className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Gerar boleto</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}

                              {/* WhatsApp Button */}
                              {contribution.lytex_invoice_url && contribution.status !== "cancelled" && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          setSendingContribution(contribution);
                                          setWhatsappDialogOpen(true);
                                        }}
                                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                      >
                                        <MessageCircle className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Enviar por WhatsApp</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}

                              {/* Email Button */}
                              {contribution.lytex_invoice_url && contribution.status !== "cancelled" && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          setSendingContribution(contribution);
                                          setEmailDialogOpen(true);
                                        }}
                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      >
                                        <Mail className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Enviar por Email</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredContributions.length)} de {filteredContributions.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports">
          <PFContributionsReportsTab
            contributions={contributions}
            contributionTypes={contributionTypes}
            clinicName={currentClinic?.name}
            clinicLogo={currentClinic?.logo_url || undefined}
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {currentClinic && user && (
        <>
          <PFContributionDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            contributionTypes={contributionTypes}
            clinicId={currentClinic.id}
            userId={user.id}
            onRefresh={fetchData}
            onGenerateInvoice={handleGenerateInvoice}
            onOpenBatch={() => {
              setCreateDialogOpen(false);
              setBatchDialogOpen(true);
            }}
          />

          <PFBatchContributionDialog
            open={batchDialogOpen}
            onOpenChange={setBatchDialogOpen}
            contributionTypes={contributionTypes}
            clinicId={currentClinic.id}
            userId={user.id}
            onRefresh={fetchData}
          />

          <BatchGenerateLytexDialog
            open={batchGenerateLytexOpen}
            onOpenChange={setBatchGenerateLytexOpen}
            yearFilter={yearFilter}
            onSuccess={fetchData}
          />

          <LytexConciliationHistoryDialog
            open={historyDialogOpen}
            onOpenChange={setHistoryDialogOpen}
            clinicId={currentClinic.id}
          />

          {selectedContribution && (
            <PFContributionDetailDialog
              open={viewDialogOpen}
              onOpenChange={setViewDialogOpen}
              contribution={selectedContribution}
              contributionTypes={contributionTypes}
              onGenerateInvoice={handleGenerateInvoice}
              generatingInvoice={generatingInvoice}
              onRefresh={fetchData}
            />
          )}

          {/* WhatsApp Dialog */}
          <SendPFContributionWhatsAppDialog
            open={whatsappDialogOpen}
            onOpenChange={setWhatsappDialogOpen}
            contribution={sendingContribution}
            clinicId={currentClinic.id}
            clinicName={currentClinic.name}
          />

          {/* Email Dialog */}
          <SendPFContributionEmailDialog
            open={emailDialogOpen}
            onOpenChange={setEmailDialogOpen}
            contribution={sendingContribution}
            clinicId={currentClinic.id}
            clinicName={currentClinic.name}
          />
        </>
      )}
    </div>
  );
}
