import { useState, useEffect, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Receipt,
  Loader2,
  Building2,
  User,
  Clock,
  Download,
  ChevronDown,
  FileBarChart,
  Hash,
  RefreshCw,
  Zap,
  CloudDownload,
  LayoutDashboard,
  Tag,
  Handshake,
  Users,
  List,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSessionValidator } from "@/hooks/useSessionValidator";
import { useUnionEntity } from "@/hooks/useUnionEntity";
import { toast } from "sonner";
import { extractFunctionsError } from "@/lib/functionsError";
import { fetchAllEmployers } from "@/lib/supabase-helpers";
import { formatCompetence } from "@/lib/competence-format";

// Components
import UnionContributionsAdvancedFilters from "@/components/union/contributions/UnionContributionsAdvancedFilters";
import UnionContributionsSummaryBar from "@/components/union/contributions/UnionContributionsSummaryBar";
import UnionContributionsBatchActions from "@/components/union/contributions/UnionContributionsBatchActions";
import UnionContributionsTable from "@/components/union/contributions/UnionContributionsTable";

// Existing dialogs and components
import ContributionDialogs from "@/components/contributions/ContributionDialogs";
import PFContributionDialog from "@/components/contributions/PFContributionDialog";
import PFBatchContributionDialog from "@/components/contributions/PFBatchContributionDialog";
import BulkContributionDialog from "@/components/contributions/BulkContributionDialog";
import OfflineContributionDialog from "@/components/contributions/OfflineContributionDialog";
import CreateWithoutValueDialog from "@/components/contributions/CreateWithoutValueDialog";
import { LytexSyncResultsDialog, LytexSyncResult } from "@/components/contributions/LytexSyncResultsDialog";
import { LytexSyncStatusIndicator } from "@/components/contributions/LytexSyncStatusIndicator";
import { LytexSyncProgress, LytexActionType } from "@/components/contributions/LytexSyncProgress";
import { LytexConciliationHistoryDialog } from "@/components/contributions/LytexConciliationHistoryDialog";
import { BatchGenerateLytexDialog } from "@/components/contributions/BatchGenerateLytexDialog";
import { SendBoletoWhatsAppDialog } from "@/components/contributions/SendBoletoWhatsAppDialog";
import { SendBoletoEmailDialog } from "@/components/contributions/SendBoletoEmailDialog";
import { generateBoletosReport } from "@/lib/boleto-report";
import NewNegotiationDialog from "@/components/negotiations/NewNegotiationDialog";
import ContributionsOverviewTab from "@/components/contributions/ContributionsOverviewTab";
import ContributionTypesTab from "@/components/contributions/ContributionTypesTab";
import ContributionsReportsTab from "@/components/contributions/ContributionsReportsTab";
import PFContributionsReportsTab from "@/components/contributions/PFContributionsReportsTab";
import NegotiationInstallmentsTab from "@/components/negotiations/NegotiationInstallmentsTab";

// Types
interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name?: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  category_id?: string | null;
  registration_number?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
  description: string | null;
  default_value: number;
  is_active: boolean;
}

interface Member {
  id: string;
  name: string;
  cpf?: string | null;
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
  public_access_token?: string | null;
  employers?: Employer;
  patients?: Member;
  contribution_types?: ContributionType;
}

interface FilterState {
  search: string;
  status: string;
  competence: string;
  contributionType: string;
  dueDateStart: string;
  dueDateEnd: string;
  paymentDateStart: string;
  paymentDateEnd: string;
}

const getInitialCompetence = () => {
  const now = new Date();
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return `${String(prevMonth).padStart(2, "0")}/${prevYear}`;
};

const getInitialYear = () => {
  const now = new Date();
  return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
};

export default function UnionContributionsPageRedesign() {
  const { currentClinic, session } = useAuth();
  const { validateSession } = useSessionValidator();
  const { entity: unionEntity } = useUnionEntity();
  
  // Data state
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [contributionTypes, setContributionTypes] = useState<ContributionType[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; color: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState<number>(getInitialYear());
  const [yearDetectionDone, setYearDetectionDone] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "hide_cancelled",
    competence: getInitialCompetence(),
    contributionType: "all",
    dueDateStart: "",
    dueDateEnd: "",
    paymentDateStart: "",
    paymentDateEnd: "",
  });
  
  // UI state
  const [activeTab, setActiveTab] = useState("contributions");
  const [documentTypeTab, setDocumentTypeTab] = useState<"pj" | "pf" | "awaiting">("pj");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [selectedContributionIds, setSelectedContributionIds] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createPFDialogOpen, setCreatePFDialogOpen] = useState(false);
  const [createPFBatchDialogOpen, setCreatePFBatchDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [offlineDialogOpen, setOfflineDialogOpen] = useState(false);
  const [createWithoutValueDialogOpen, setCreateWithoutValueDialogOpen] = useState(false);
  const [batchGenerateLytexOpen, setBatchGenerateLytexOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [syncResultsOpen, setSyncResultsOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<LytexSyncResult | null>(null);
  const [negotiationDialogOpen, setNegotiationDialogOpen] = useState(false);
  const [negotiationEmployerId, setNegotiationEmployerId] = useState<string | undefined>(undefined);
  
  // Loading states
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [extractingRegistrations, setExtractingRegistrations] = useState(false);
  const [fixingTypes, setFixingTypes] = useState(false);
  const [fetchingPaid, setFetchingPaid] = useState(false);
  const [currentSyncLogId, setCurrentSyncLogId] = useState<string | null>(null);
  const [currentActionType, setCurrentActionType] = useState<LytexActionType>("import");

  // Detect best year on mount
  useEffect(() => {
    if (currentClinic && !yearDetectionDone) {
      detectBestYear();
    }
  }, [currentClinic]);

  const detectBestYear = async () => {
    if (!currentClinic?.id) return;
    const targetYear = getInitialYear();

    const { count: targetCount } = await supabase
      .from("employer_contributions")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", currentClinic.id)
      .eq("competence_year", targetYear);

    if (targetCount && targetCount > 0) {
      setYearFilter(targetYear);
      setYearDetectionDone(true);
      return;
    }

    const { data } = await supabase
      .from("employer_contributions")
      .select("competence_year")
      .eq("clinic_id", currentClinic.id)
      .order("competence_year", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setYearFilter(data[0].competence_year);
    }
    setYearDetectionDone(true);
  };

  // Fetch data
  useEffect(() => {
    if (currentClinic && yearDetectionDone) {
      fetchData();
    }
  }, [currentClinic, yearFilter, yearDetectionDone]);

  useEffect(() => {
    if (currentClinic) {
      fetchCategories();
    }
  }, [currentClinic?.id]);

  const fetchCategories = async () => {
    if (!currentClinic) return;
    const { data, error } = await supabase
      .from("employer_categories")
      .select("id, name, color")
      .eq("clinic_id", currentClinic.id)
      .eq("is_active", true)
      .order("name");
    if (!error && data) setCategories(data);
  };

  const fetchData = async () => {
    if (!currentClinic) return;
    setLoading(true);

    try {
      const { data: contribData, error: contribError } = await supabase
        .from("employer_contributions")
        .select(`
          *,
          employers (id, name, cnpj, trade_name, email, phone, address, city, state, category_id, registration_number),
          contribution_types (id, name, description, default_value, is_active),
          patients:member_id (id, name, cpf)
        `)
        .eq("clinic_id", currentClinic.id)
        .eq("competence_year", yearFilter)
        .order("competence_month", { ascending: false })
        .order("created_at", { ascending: false });

      if (contribError) throw contribError;
      setContributions(contribData || []);

      const employersResult = await fetchAllEmployers<Employer>(currentClinic.id, {
        select: "id, name, cnpj, trade_name, email, phone, address, city, state, category_id, registration_number"
      });
      if (employersResult.error) throw employersResult.error;
      setEmployers(employersResult.data);

      const { data: typesData, error: typesError } = await supabase
        .from("contribution_types")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("name");
      if (typesError) throw typesError;
      setContributionTypes(typesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // Separate contributions by type
  const pjContributions = useMemo(() => 
    contributions.filter(c => !c.member_id && c.status !== "awaiting_value"),
    [contributions]
  );

  const pfContributions = useMemo(() => 
    contributions.filter(c => !!c.member_id && c.status !== "awaiting_value"),
    [contributions]
  );

  const awaitingContributions = useMemo(() => 
    contributions.filter(c => c.status === "awaiting_value" || (!c.lytex_invoice_url && c.public_access_token)),
    [contributions]
  );

  const activeContributions = documentTypeTab === "pj" 
    ? pjContributions 
    : documentTypeTab === "pf" 
      ? pfContributions
      : awaitingContributions;

  // Filter contributions
  const filteredContributions = useMemo(() => {
    return activeContributions.filter((c) => {
      // Search
      let matchesSearch = true;
      if (filters.search.trim()) {
        const searchLower = filters.search.toLowerCase().trim();
        const searchClean = filters.search.replace(/\D/g, "");
        
        if (documentTypeTab === "pj" || documentTypeTab === "awaiting") {
          const employerNameMatch = c.employers?.name?.toLowerCase().includes(searchLower);
          const employerTradeNameMatch = c.employers?.trade_name?.toLowerCase().includes(searchLower);
          const cnpjClean = c.employers?.cnpj?.replace(/\D/g, "") || "";
          const cnpjMatch = searchClean.length >= 3 && cnpjClean.includes(searchClean);
          const registrationMatch = c.employers?.registration_number?.toLowerCase().includes(searchLower);
          matchesSearch = !!(employerNameMatch || employerTradeNameMatch || cnpjMatch || registrationMatch);
        } else {
          const memberNameMatch = c.patients?.name?.toLowerCase().includes(searchLower);
          const cpfClean = c.patients?.cpf?.replace(/\D/g, "") || "";
          const cpfMatch = searchClean.length >= 3 && cpfClean.includes(searchClean);
          matchesSearch = !!(memberNameMatch || cpfMatch);
        }
      }

      // Status
      const matchesStatus = filters.status === "all" || 
        (filters.status === "hide_cancelled" ? c.status !== "cancelled" : c.status === filters.status);

      // Competence
      let matchesCompetence = true;
      if (filters.competence !== "all") {
        const [filterMonth, filterYear] = filters.competence.split("/").map(Number);
        matchesCompetence = c.competence_month === filterMonth && c.competence_year === filterYear;
      }

      // Contribution type
      const matchesType = filters.contributionType === "all" || c.contribution_type_id === filters.contributionType;

      // Due date range
      let matchesDueDate = true;
      if (filters.dueDateStart) {
        matchesDueDate = matchesDueDate && c.due_date >= filters.dueDateStart;
      }
      if (filters.dueDateEnd) {
        matchesDueDate = matchesDueDate && c.due_date <= filters.dueDateEnd;
      }

      // Payment date range
      let matchesPaymentDate = true;
      if (c.paid_at && (filters.paymentDateStart || filters.paymentDateEnd)) {
        const paidDate = c.paid_at.split("T")[0];
        if (filters.paymentDateStart) {
          matchesPaymentDate = matchesPaymentDate && paidDate >= filters.paymentDateStart;
        }
        if (filters.paymentDateEnd) {
          matchesPaymentDate = matchesPaymentDate && paidDate <= filters.paymentDateEnd;
        }
      } else if (filters.paymentDateStart || filters.paymentDateEnd) {
        matchesPaymentDate = false;
      }

      return matchesSearch && matchesStatus && matchesCompetence && matchesType && matchesDueDate && matchesPaymentDate;
    });
  }, [activeContributions, filters, documentTypeTab]);

  // Pagination
  const totalPages = Math.ceil(filteredContributions.length / itemsPerPage);
  const paginatedContributions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredContributions.slice(start, start + itemsPerPage);
  }, [filteredContributions, currentPage, itemsPerPage]);

  // Selection helpers
  const eligibleOnPage = useMemo(() => 
    paginatedContributions.filter(c => 
      (c.lytex_invoice_id || c.public_access_token) && c.status !== "paid" && c.status !== "cancelled"
    ),
    [paginatedContributions]
  );

  const allEligibleContributions = useMemo(() => 
    filteredContributions.filter(c => 
      (c.lytex_invoice_id || c.public_access_token) && c.status !== "paid" && c.status !== "cancelled"
    ),
    [filteredContributions]
  );

  const allVisibleSelected = eligibleOnPage.length > 0 && eligibleOnPage.every(c => selectedContributionIds.has(c.id));
  const allEligibleSelected = allEligibleContributions.length > 0 && allEligibleContributions.every(c => selectedContributionIds.has(c.id));

  const selectedContributions = useMemo(() => {
    if (selectedContributionIds.size === 0) return filteredContributions;
    return contributions.filter(c => selectedContributionIds.has(c.id));
  }, [contributions, filteredContributions, selectedContributionIds]);

  // Handlers
  const handleToggleSelection = (id: string) => {
    const newSet = new Set(selectedContributionIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedContributionIds(newSet);
  };

  const handleSelectAllVisible = () => {
    const newSet = new Set(selectedContributionIds);
    if (allVisibleSelected) {
      eligibleOnPage.forEach(c => newSet.delete(c.id));
    } else {
      eligibleOnPage.forEach(c => newSet.add(c.id));
    }
    setSelectedContributionIds(newSet);
  };

  const handleSelectAllEligible = () => {
    if (allEligibleSelected) {
      setSelectedContributionIds(new Set());
    } else {
      setSelectedContributionIds(new Set(allEligibleContributions.map(c => c.id)));
    }
  };

  const handleViewContribution = (contribution: Contribution) => {
    setSelectedContribution(contribution);
    setViewDialogOpen(true);
  };

  const handleGenerateInvoice = async (contribution: Contribution) => {
    const isPF = !!contribution.member_id;
    
    if (isPF) {
      if (!contribution.patients?.cpf) {
        toast.error("CPF do contribuinte não informado");
        return;
      }
    } else if (!contribution.employers) {
      toast.error("Dados da empresa não encontrados");
      return;
    }

    const isSessionValid = await validateSession();
    if (!isSessionValid) return;

    setGeneratingInvoice(true);
    try {
      const body: Record<string, unknown> = {
        action: "create_invoice",
        contributionId: contribution.id,
        clinicId: currentClinic?.id,
        value: contribution.value,
        dueDate: contribution.due_date,
        description: `${contribution.contribution_types?.name || "Contribuição"} - ${formatCompetence(contribution.competence_month, contribution.competence_year)}`,
        enableBoleto: true,
        enablePix: true,
      };

      if (isPF) {
        body.member = {
          cpf: contribution.patients!.cpf,
          name: contribution.patients!.name,
        };
      } else {
        body.employer = {
          cnpj: contribution.employers!.cnpj,
          name: contribution.employers!.name,
          email: contribution.employers!.email,
          phone: contribution.employers!.phone,
          address: contribution.employers!.address ? {
            street: contribution.employers!.address,
            city: contribution.employers!.city,
            state: contribution.employers!.state,
          } : undefined,
        };
      }

      const response = await supabase.functions.invoke("lytex-api", { body });
      if (response.error) throw new Error(response.error.message);

      toast.success("Boleto gerado com sucesso!");
      setViewDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
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
    setCurrentActionType("sync");
    try {
      const { data, error } = await supabase.functions.invoke("lytex-api", {
        body: { action: "sync_all_pending", clinicId: currentClinic.id },
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
      toast.error(`Erro ao sincronizar: ${message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleImportFromLytex = async () => {
    if (!currentClinic) return;
    const isSessionValid = await validateSession();
    if (!isSessionValid) return;
    
    setImporting(true);
    setCurrentSyncLogId(null);
    setCurrentActionType("import");
    
    try {
      const response = supabase.functions.invoke("lytex-api", {
        body: { action: "import_from_lytex", clinicId: currentClinic.id },
      });

      const checkForLog = async () => {
        const { data: logs } = await supabase
          .from("lytex_sync_logs")
          .select("id")
          .eq("clinic_id", currentClinic.id)
          .eq("status", "running")
          .order("created_at", { ascending: false })
          .limit(1);
        
        if (logs && logs.length > 0) {
          setCurrentSyncLogId(logs[0].id);
        }
      };
      
      await checkForLog();
      const logCheckInterval = setInterval(checkForLog, 500);
      
      const { data, error } = await response;
      clearInterval(logCheckInterval);

      if (error) throw error;

      let details = undefined;
      if (data?.syncLogId) {
        const { data: logData } = await supabase
          .from("lytex_sync_logs")
          .select("details")
          .eq("id", data.syncLogId)
          .single();
        
        if (logData?.details) {
          details = logData.details as { clients?: unknown[]; invoices?: unknown[]; errors?: string[] };
        }
      }

      const result: LytexSyncResult = {
        syncedAt: new Date(),
        clientsImported: data?.clientsImported || 0,
        clientsUpdated: data?.clientsUpdated || 0,
        invoicesImported: data?.invoicesImported || 0,
        invoicesUpdated: data?.invoicesUpdated || 0,
        errors: data?.errors || [],
        details,
      };
      
      setSyncResult(result);
      setSyncResultsOpen(true);
      fetchData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao importar: ${errorMessage}`);
    } finally {
      setImporting(false);
    }
  };

  const handleTabChange = (value: string) => {
    setDocumentTypeTab(value as "pj" | "pf" | "awaiting");
    setCurrentPage(1);
    setSelectedContributionIds(new Set());
  };

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
    
    if (newFilters.competence !== "all") {
      const [, year] = newFilters.competence.split("/").map(Number);
      if (year && year !== yearFilter) {
        setYearFilter(year);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentClinic) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Nenhuma clínica vinculada. Entre em contato com o administrador.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Gerenciando contas a receber de Empresas
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie o recebimento das empresas associadas, gere e cancele boletos de forma prática
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={importing || extractingRegistrations || fixingTypes}>
              {importing || extractingRegistrations || fixingTypes ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Lytex
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleImportFromLytex} disabled={importing}>
              <Download className="h-4 w-4 mr-2" />
              Importar Clientes e Faturas
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBatchGenerateLytexOpen(true)} className="text-amber-600">
              <Zap className="h-4 w-4 mr-2" />
              Gerar Boletos Pendentes
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setHistoryDialogOpen(true)}>
              <FileBarChart className="h-4 w-4 mr-2" />
              Histórico de Sincronização
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Lytex Sync Status */}
      <LytexSyncStatusIndicator
        clinicId={currentClinic.id}
        onSyncClick={handleSyncAll}
        syncing={syncing}
      />

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="contributions" className="gap-2">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Contribuições</span>
          </TabsTrigger>
          <TabsTrigger value="negotiations" className="gap-2">
            <Handshake className="h-4 w-4" />
            <span className="hidden sm:inline">Negociações</span>
          </TabsTrigger>
          <TabsTrigger value="types" className="gap-2">
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Tipos</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <FileBarChart className="h-4 w-4" />
            <span className="hidden sm:inline">Relatórios PJ</span>
          </TabsTrigger>
          <TabsTrigger value="reports-pf" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Relatórios PF</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ContributionsOverviewTab
            contributions={contributions}
            employers={employers}
            contributionTypes={contributionTypes}
            yearFilter={yearFilter}
          />
        </TabsContent>

        <TabsContent value="contributions" className="space-y-4">
          {/* Document Type Tabs */}
          <Tabs value={documentTypeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full max-w-xl grid-cols-3">
              <TabsTrigger value="pj" className="gap-2">
                <Building2 className="h-4 w-4" />
                Empresas (PJ)
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {pjContributions.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="pf" className="gap-2">
                <User className="h-4 w-4" />
                Pessoa Física (PF)
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {pfContributions.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="awaiting" className="gap-2">
                <Clock className="h-4 w-4" />
                Aguardando Valor
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                  {awaitingContributions.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Advanced Filters */}
          <UnionContributionsAdvancedFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            contributionTypes={contributionTypes}
            onSearch={() => setCurrentPage(1)}
            resultCount={filteredContributions.length}
          />

          {/* Summary Bar */}
          <UnionContributionsSummaryBar contributions={filteredContributions} />

          {/* Batch Actions */}
          <UnionContributionsBatchActions
            selectedCount={selectedContributionIds.size}
            totalEligible={allEligibleContributions.length}
            allSelected={allEligibleSelected}
            onSelectAll={handleSelectAllEligible}
            onWhatsApp={() => setWhatsappDialogOpen(true)}
            onEmail={() => setEmailDialogOpen(true)}
            onPrint={() => generateBoletosReport(selectedContributions.filter(c => c.lytex_invoice_id))}
            onSync={handleSyncAll}
            syncing={syncing}
            onCreatePJ={() => setCreateDialogOpen(true)}
            onCreateWithoutValue={() => setCreateWithoutValueDialogOpen(true)}
            onBulkGenerate={() => setBulkDialogOpen(true)}
            onNegotiate={() => setNegotiationDialogOpen(true)}
            onBatchGenerateLytex={() => setBatchGenerateLytexOpen(true)}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
            documentType={documentTypeTab}
            onCreatePF={() => setCreatePFDialogOpen(true)}
          />

          {/* Table */}
          <UnionContributionsTable
            contributions={paginatedContributions}
            selectedIds={selectedContributionIds}
            onToggleSelection={handleToggleSelection}
            onSelectAllVisible={handleSelectAllVisible}
            allVisibleSelected={allVisibleSelected}
            eligibleOnPageCount={eligibleOnPage.length}
            onViewContribution={handleViewContribution}
            documentType={documentTypeTab}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalCount={filteredContributions.length}
            itemsPerPage={itemsPerPage}
          />
        </TabsContent>

        <TabsContent value="negotiations">
          <NegotiationInstallmentsTab
            clinicId={currentClinic.id}
            yearFilter={yearFilter}
          />
        </TabsContent>

        <TabsContent value="types">
          <ContributionTypesTab
            contributionTypes={contributionTypes}
            clinicId={currentClinic.id}
            onRefresh={fetchData}
          />
        </TabsContent>

        <TabsContent value="reports">
          <ContributionsReportsTab
            contributions={contributions.filter(c => !c.member_id)}
            employers={employers}
            contributionTypes={contributionTypes}
            clinicName={currentClinic.name}
            clinicLogo={currentClinic.logo_url || undefined}
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
          />
        </TabsContent>

        <TabsContent value="reports-pf">
          <PFContributionsReportsTab
            contributions={contributions.filter(c => !!c.member_id)}
            contributionTypes={contributionTypes}
            clinicName={currentClinic.name}
            clinicLogo={currentClinic.logo_url || undefined}
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ContributionDialogs
        createDialogOpen={createDialogOpen}
        onCreateDialogChange={setCreateDialogOpen}
        employers={employers}
        contributionTypes={contributionTypes}
        clinicId={currentClinic.id}
        userId={session?.user.id || ""}
        onRefresh={fetchData}
        viewDialogOpen={viewDialogOpen}
        onViewDialogChange={setViewDialogOpen}
        selectedContribution={selectedContribution}
        onGenerateInvoice={handleGenerateInvoice}
        generatingInvoice={generatingInvoice}
        allowDuplicateCompetence={unionEntity?.allow_duplicate_competence ?? false}
      />

      <PFContributionDialog
        open={createPFDialogOpen}
        onOpenChange={setCreatePFDialogOpen}
        contributionTypes={contributionTypes}
        clinicId={currentClinic.id}
        userId={session?.user.id || ""}
        onRefresh={fetchData}
        onGenerateInvoice={handleGenerateInvoice}
        onOpenBatch={() => {
          setCreatePFDialogOpen(false);
          setCreatePFBatchDialogOpen(true);
        }}
      />

      <PFBatchContributionDialog
        open={createPFBatchDialogOpen}
        onOpenChange={setCreatePFBatchDialogOpen}
        contributionTypes={contributionTypes}
        clinicId={currentClinic.id}
        userId={session?.user.id || ""}
        onRefresh={fetchData}
      />

      <BulkContributionDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        employers={employers}
        contributionTypes={contributionTypes}
        clinicId={currentClinic.id}
        userId={session?.user.id || ""}
        onRefresh={fetchData}
        onEnsureYearVisible={setYearFilter}
        categories={categories}
      />

      <OfflineContributionDialog
        open={offlineDialogOpen}
        onOpenChange={setOfflineDialogOpen}
        contributionTypes={contributionTypes}
        clinicId={currentClinic.id}
        userId={session?.user.id || ""}
        onRefresh={fetchData}
        categories={categories}
      />

      <CreateWithoutValueDialog
        open={createWithoutValueDialogOpen}
        onOpenChange={setCreateWithoutValueDialogOpen}
        employers={employers}
        contributionTypes={contributionTypes}
        clinicId={currentClinic.id}
        userId={session?.user.id || ""}
        onSuccess={fetchData}
        onEnsureYearVisible={setYearFilter}
      />

      <SendBoletoWhatsAppDialog
        open={whatsappDialogOpen}
        onOpenChange={setWhatsappDialogOpen}
        contributions={selectedContributions}
        clinicId={currentClinic.id}
      />

      <SendBoletoEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        contributions={selectedContributions}
        clinicId={currentClinic.id}
      />

      <LytexSyncResultsDialog
        open={syncResultsOpen}
        onOpenChange={setSyncResultsOpen}
        result={syncResult}
      />

      <LytexSyncProgress 
        syncLogId={currentSyncLogId} 
        isActive={importing || syncing || fixingTypes || extractingRegistrations || fetchingPaid}
        actionType={currentActionType}
      />

      <LytexConciliationHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        clinicId={currentClinic.id}
      />

      <BatchGenerateLytexDialog
        open={batchGenerateLytexOpen}
        onOpenChange={setBatchGenerateLytexOpen}
        onSuccess={fetchData}
        yearFilter={yearFilter}
      />

      <NewNegotiationDialog
        open={negotiationDialogOpen}
        onOpenChange={(open) => {
          setNegotiationDialogOpen(open);
          if (!open) setNegotiationEmployerId(undefined);
        }}
        clinicId={currentClinic.id}
        userId={session?.user.id || ""}
        employers={employers as any}
        onSuccess={() => {
          fetchData();
          setActiveTab("negotiations");
        }}
      />
    </div>
  );
}
