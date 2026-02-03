import { useState, useEffect, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Receipt,
  Loader2,
  LayoutDashboard,
  List,
  Tag,
  FileBarChart,
  Download,
  ChevronDown,
  RefreshCw,
  Zap,
  CloudDownload,
  Hash,
  Handshake,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSessionValidator } from "@/hooks/useSessionValidator";
import { useUnionEntity } from "@/hooks/useUnionEntity";
import { toast } from "sonner";
import { extractFunctionsError } from "@/lib/functionsError";
import { fetchAllEmployers } from "@/lib/supabase-helpers";
import { formatCompetence } from "@/lib/competence-format";

// Existing components from dashboard pattern
import ContributionsOverviewTab from "@/components/contributions/ContributionsOverviewTab";
import ContributionsListTab from "@/components/contributions/ContributionsListTab";
import ContributionTypesTab from "@/components/contributions/ContributionTypesTab";
import ContributionsReportsTab from "@/components/contributions/ContributionsReportsTab";
import PFContributionsReportsTab from "@/components/contributions/PFContributionsReportsTab";
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
import NegotiationInstallmentsTab from "@/components/negotiations/NegotiationInstallmentsTab";
import NewNegotiationDialog from "@/components/negotiations/NewNegotiationDialog";

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
  
  // UI state
  const [activeTab, setActiveTab] = useState("overview");
  
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
  const [importingExternal, setImportingExternal] = useState(false);
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

  const handleViewContribution = (contribution: Contribution) => {
    setSelectedContribution(contribution);
    setViewDialogOpen(true);
  };

  const handleGenerateInvoice = async (contribution: Contribution) => {
    const isPF = !!contribution.member_id;
    
    if (isPF) {
      if (!contribution.patients) {
        toast.error("Dados do contribuinte não encontrados");
        return;
      }
      if (!contribution.patients.cpf) {
        toast.error("CPF do contribuinte não informado");
        return;
      }
    } else {
      if (!contribution.employers) {
        toast.error("Dados da empresa não encontrados");
        return;
      }
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
    setCurrentActionType("sync");
    try {
      const { data, error } = await supabase.functions.invoke("lytex-api", {
        body: {
          action: "sync_all_pending",
          clinicId: currentClinic.id,
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

  const handleImportFromLytex = async () => {
    if (!currentClinic) return;
    
    const isSessionValid = await validateSession();
    if (!isSessionValid) return;
    
    setImporting(true);
    setCurrentSyncLogId(null);
    setCurrentActionType("import");
    
    try {
      const response = supabase.functions.invoke("lytex-api", {
        body: {
          action: "import_from_lytex",
          clinicId: currentClinic.id,
        },
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

      const imported = (data?.clientsImported || 0) + (data?.invoicesImported || 0);
      const updated = (data?.clientsUpdated || 0) + (data?.invoicesUpdated || 0);

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

      if (data?.errors?.length) {
        toast.warning(`Sincronização concluída com ${data.errors.length} erro(s)`);
      } else if (imported > 0 || updated > 0) {
        toast.success("Sincronização concluída com sucesso!");
      } else {
        toast.info("Nenhum dado novo encontrado na Lytex");
      }

      fetchData();
    } catch (error) {
      const { message } = extractFunctionsError(error);
      console.error("Error importing from Lytex:", error);
      toast.error(`Erro ao importar: ${message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleExtractRegistrations = async () => {
    if (!currentClinic) return;
    
    const isSessionValid = await validateSession();
    if (!isSessionValid) return;
    
    setExtractingRegistrations(true);
    setCurrentActionType("extract_registrations");
    try {
      const { data, error } = await supabase.functions.invoke("lytex-api", {
        body: {
          action: "extract_registrations",
          clinicId: currentClinic.id,
        },
      });

      if (error) throw error;

      if (data?.updated > 0) {
        toast.success(`${data.updated} matrícula(s) extraída(s) com sucesso!`);
        fetchData();
      } else {
        toast.info("Nenhuma matrícula encontrada para extrair");
      }
    } catch (error) {
      const { message } = extractFunctionsError(error);
      console.error("Error extracting registrations:", error);
      toast.error(`Erro ao extrair matrículas: ${message}`);
    } finally {
      setExtractingRegistrations(false);
    }
  };

  const handleFixContributionTypes = async () => {
    if (!currentClinic) return;
    
    const isSessionValid = await validateSession();
    if (!isSessionValid) return;
    
    setFixingTypes(true);
    setCurrentActionType("fix_types");
    try {
      const { data, error } = await supabase.functions.invoke("lytex-api", {
        body: {
          action: "fix_contribution_types",
          clinicId: currentClinic.id,
        },
      });

      if (error) throw error;

      if (data?.updated > 0) {
        toast.success(`${data.updated} tipo(s) de contribuição corrigido(s)!`);
        fetchData();
      } else {
        toast.info("Nenhum tipo de contribuição precisou de correção");
      }
    } catch (error) {
      const { message } = extractFunctionsError(error);
      console.error("Error fixing contribution types:", error);
      toast.error(`Erro ao corrigir tipos: ${message}`);
    } finally {
      setFixingTypes(false);
    }
  };

  const handleFetchPaidInvoices = async () => {
    if (!currentClinic) return;
    
    const isSessionValid = await validateSession();
    if (!isSessionValid) return;
    
    setFetchingPaid(true);
    setCurrentSyncLogId(null);
    setCurrentActionType("sync");
    try {
      const response = supabase.functions.invoke("lytex-api", {
        body: {
          action: "fetch_paid_invoices",
          clinicId: currentClinic.id,
        },
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

      if (data?.updated > 0) {
        toast.success(`${data.updated} pagamento(s) conciliado(s)!`);
        fetchData();
      } else {
        toast.info("Nenhum pagamento novo encontrado");
      }
    } catch (error) {
      const { message } = extractFunctionsError(error);
      console.error("Error fetching paid invoices:", error);
      toast.error(`Erro ao buscar pagamentos: ${message}`);
    } finally {
      setFetchingPaid(false);
    }
  };

  const handleImportExternalPaidInvoices = async () => {
    if (!currentClinic) return;
    
    const isSessionValid = await validateSession();
    if (!isSessionValid) return;
    
    setImportingExternal(true);
    setCurrentActionType("import");
    try {
      const { data, error } = await supabase.functions.invoke("lytex-api", {
        body: {
          action: "import_external_paid",
          clinicId: currentClinic.id,
        },
      });

      if (error) throw error;

      if (data?.imported > 0) {
        toast.success(`${data.imported} boleto(s) externo(s) importado(s)!`);
        fetchData();
      } else {
        toast.info("Nenhum boleto externo encontrado");
      }
    } catch (error) {
      const { message } = extractFunctionsError(error);
      console.error("Error importing external paid invoices:", error);
      toast.error(`Erro ao importar boletos externos: ${message}`);
    } finally {
      setImportingExternal(false);
    }
  };

  if (loading && !yearDetectionDone) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentClinic) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
              <span className="truncate">Contribuições Sindicais</span>
            </h1>
            <p className="text-sm text-muted-foreground hidden sm:block">
              Gerencie boletos e contribuições das empresas associadas
            </p>
          </div>

          {/* Actions Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-9"
                  disabled={importing || extractingRegistrations || fixingTypes}
                >
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
                <DropdownMenuItem onClick={handleExtractRegistrations} disabled={extractingRegistrations}>
                  <Hash className="h-4 w-4 mr-2" />
                  Extrair Matrículas das Faturas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleFixContributionTypes} disabled={fixingTypes}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Corrigir Tipos de Contribuição
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
                <DropdownMenuItem onClick={() => setHistoryDialogOpen(true)}>
                  <FileBarChart className="h-4 w-4 mr-2" />
                  Histórico de Sincronização
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Lytex Sync Status */}
      <LytexSyncStatusIndicator
        clinicId={currentClinic.id}
        onSyncClick={handleSyncAll}
        syncing={syncing}
      />

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full sm:w-auto sm:inline-flex">
          <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
            <LayoutDashboard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="contributions" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
            <List className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline sm:inline">Contribuições</span>
          </TabsTrigger>
          <TabsTrigger value="negotiations" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
            <Handshake className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline sm:inline">Negociações</span>
          </TabsTrigger>
          <TabsTrigger value="types" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
            <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline sm:inline">Tipos</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
            <FileBarChart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Relatórios PJ</span>
          </TabsTrigger>
          <TabsTrigger value="reports-pf" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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

        <TabsContent value="contributions">
          <ContributionsListTab
            contributions={contributions}
            onViewContribution={handleViewContribution}
            onGenerateInvoice={handleGenerateInvoice}
            onOpenCreate={() => setCreateDialogOpen(true)}
            onOpenCreatePF={() => setCreatePFDialogOpen(true)}
            onOpenCreateWithoutValue={() => setCreateWithoutValueDialogOpen(true)}
            onSyncAll={handleSyncAll}
            generatingInvoice={generatingInvoice}
            syncing={syncing}
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
            clinicId={currentClinic.id}
            onOpenNegotiation={(employerId?: string) => {
              setNegotiationEmployerId(employerId);
              setNegotiationDialogOpen(true);
            }}
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
        employers={employers.map(e => ({
          id: e.id,
          name: e.name,
          cnpj: e.cnpj,
          trade_name: e.trade_name,
          registration_number: e.registration_number,
        }))}
        onSuccess={() => {
          fetchData();
          setNegotiationDialogOpen(false);
          setNegotiationEmployerId(undefined);
        }}
        initialEmployerId={negotiationEmployerId}
      />
    </div>
  );
}
