import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Receipt, LayoutDashboard, List, Tag, FileBarChart, Loader2, Download, FileStack, Handshake, Hash, ChevronDown, RefreshCw, FileX, CloudDownload, Zap, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSessionValidator } from "@/hooks/useSessionValidator";
import { useUnionEntity } from "@/hooks/useUnionEntity";
import { toast } from "sonner";
import { extractFunctionsError } from "@/lib/functionsError";
import { fetchAllEmployers } from "@/lib/supabase-helpers";

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
import NegotiationInstallmentsTab from "@/components/negotiations/NegotiationInstallmentsTab";
import NewNegotiationDialog from "@/components/negotiations/NewNegotiationDialog";
import { LytexSyncStatusIndicator } from "@/components/contributions/LytexSyncStatusIndicator";
import { LytexSyncProgress, LytexActionType } from "@/components/contributions/LytexSyncProgress";
import { LytexConciliationHistoryDialog } from "@/components/contributions/LytexConciliationHistoryDialog";
import { BatchGenerateLytexDialog } from "@/components/contributions/BatchGenerateLytexDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  employers?: Employer;
  patients?: Member;
  contribution_types?: ContributionType;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

import { formatCompetence } from "@/lib/competence-format";

export default function ContributionsPage() {
  const { currentClinic, session } = useAuth();
  const { validateSession } = useSessionValidator();
  const { entity: unionEntity } = useUnionEntity();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [contributionTypes, setContributionTypes] = useState<ContributionType[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; color: string }[]>([]);
  const [loading, setLoading] = useState(true);
  // Initialize with previous month's year (for January, use previous year)
  const getInitialYear = () => {
    const now = new Date();
    return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  };
  const [yearFilter, setYearFilter] = useState<number>(getInitialYear());
  const [activeTab, setActiveTab] = useState("overview");
  const [detectedYear, setDetectedYear] = useState<number | null>(null);
  const [yearDetectionDone, setYearDetectionDone] = useState(false);

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
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [extractingRegistrations, setExtractingRegistrations] = useState(false);
  const [fixingTypes, setFixingTypes] = useState(false);
  const [fetchingPaid, setFetchingPaid] = useState(false);
  const [importingExternal, setImportingExternal] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [syncResultsOpen, setSyncResultsOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<LytexSyncResult | null>(null);
  const [currentSyncLogId, setCurrentSyncLogId] = useState<string | null>(null);
  const [negotiationDialogOpen, setNegotiationDialogOpen] = useState(false);
  const [negotiationEmployerId, setNegotiationEmployerId] = useState<string | undefined>(undefined);
  const [currentActionType, setCurrentActionType] = useState<LytexActionType>("import");

  // Detectar o ano com mais dados quando não há dados no ano atual
  useEffect(() => {
    if (currentClinic && !yearDetectionDone) {
      detectBestYear();
    }
  }, [currentClinic]);

  const detectBestYear = async () => {
    if (!currentClinic?.id) return;

    console.debug("[ContributionsPage] detectBestYear called", { clinicId: currentClinic.id });

    // Default behavior: start on the previous month's year (e.g. January => previous year)
    // but if that year has no data, fall back to the most recent year available.
    const targetYear = getInitialYear();

    const { count: targetCount, error: countError } = await supabase
      .from("employer_contributions")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", currentClinic.id)
      .eq("competence_year", targetYear);

    console.debug("[ContributionsPage] targetYear check", { 
      targetYear, 
      targetCount, 
      countError: countError?.message 
    });

    if (targetCount && targetCount > 0) {
      setYearFilter(targetYear);
      setYearDetectionDone(true);
      return;
    }

    // Fallback: buscar o ano mais recente com dados
    const { data, error: fallbackError } = await supabase
      .from("employer_contributions")
      .select("competence_year")
      .eq("clinic_id", currentClinic.id)
      .order("competence_year", { ascending: false })
      .limit(1);

    console.debug("[ContributionsPage] fallback year", { 
      data, 
      fallbackError: fallbackError?.message 
    });

    if (data && data.length > 0) {
      const bestYear = data[0].competence_year;
      setYearFilter(bestYear);
      setDetectedYear(bestYear);
    }

    setYearDetectionDone(true);
  };

  useEffect(() => {
    if (currentClinic && yearDetectionDone) {
      fetchData();
    }
  }, [currentClinic, yearFilter, yearDetectionDone]);

  // Fetch categories only once (they don't depend on yearFilter)
  const fetchCategories = async () => {
    if (!currentClinic) return;
    
    const { data: catData, error: catError } = await supabase
      .from("employer_categories")
      .select("id, name, color")
      .eq("clinic_id", currentClinic.id)
      .eq("is_active", true)
      .order("name");

    if (!catError && catData) {
      setCategories(catData);
    }
  };

  // Fetch categories on mount
  useEffect(() => {
    if (currentClinic) {
      fetchCategories();
    }
  }, [currentClinic?.id]);

  const fetchData = async () => {
    if (!currentClinic) return;
    setLoading(true);

    try {
      // Fetch contributions with relations - filtered by year
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
      console.debug("[ContributionsPage] loaded", {
        clinicId: currentClinic.id,
        yearFilter,
        contributions: contribData?.length ?? 0,
      });
      setContributions(contribData || []);

      // Fetch employers with category - using pagination to avoid 1000 limit
      const employersResult = await fetchAllEmployers<Employer>(currentClinic.id, {
        select: "id, name, cnpj, trade_name, email, phone, address, city, state, category_id, registration_number"
      });
      if (employersResult.error) throw employersResult.error;
      setEmployers(employersResult.data);

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
    // Para contribuições PF (member_id), usar dados do paciente/membro
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

    // Validar sessão antes de chamar a Edge Function
    const isSessionValid = await validateSession();
    if (!isSessionValid) {
      return;
    }

    setGeneratingInvoice(true);
    try {
      // Montar body de acordo com tipo (PJ ou PF)
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
        // Contribuição Pessoa Física - usar CPF do membro
        body.member = {
          cpf: contribution.patients!.cpf,
          name: contribution.patients!.name,
        };
      } else {
        // Contribuição PJ - usar dados da empresa
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
    
    // Validar sessão antes de chamar a Edge Function
    const isSessionValid = await validateSession();
    if (!isSessionValid) {
      return;
    }
    
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
    
    // Validar sessão antes de chamar a Edge Function
    const isSessionValid = await validateSession();
    if (!isSessionValid) {
      return;
    }
    
    setImporting(true);
    setCurrentSyncLogId(null);
    setCurrentActionType("import");
    
    try {
      // Fazer a chamada sem await para obter o syncLogId o mais rápido possível
      const response = supabase.functions.invoke("lytex-api", {
        body: {
          action: "import_from_lytex",
          clinicId: currentClinic.id,
        },
      });

      // Buscar o log mais recente para obter o ID (criado pela edge function)
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
      
      // Verificar imediatamente e depois a cada 500ms
      await checkForLog();
      const logCheckInterval = setInterval(checkForLog, 500);
      
      const { data, error } = await response;
      clearInterval(logCheckInterval);

      if (error) throw error;

      const imported = (data?.clientsImported || 0) + (data?.invoicesImported || 0);
      const updated = (data?.clientsUpdated || 0) + (data?.invoicesUpdated || 0);

      // Buscar detalhes do banco usando syncLogId
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

      // Montar resultado para exibição
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Error importing:", error);
      toast.error(`Erro ao importar: ${errorMessage}`);
    } finally {
      setImporting(false);
    }
  };

  const handleExtractRegistrations = async () => {
    if (!currentClinic) return;
    
    // Validar sessão antes de chamar a Edge Function
    const isSessionValid = await validateSession();
    if (!isSessionValid) {
      return;
    }
    
    setExtractingRegistrations(true);
    setCurrentActionType("extract_registrations");
    try {
      const { data, error } = await supabase.functions.invoke("lytex-api", {
        body: {
          action: "extract_registration_numbers",
          clinicId: currentClinic.id,
        },
      });

      if (error) throw error;

      if (data?.updated > 0) {
        toast.success(`${data.updated} matrícula(s) atualizada(s) com sucesso!`);
      } else if (data?.skipped > 0) {
        toast.info(`Nenhuma nova matrícula encontrada. ${data.skipped} empresa(s) já possuem matrícula.`);
      } else {
        toast.info("Nenhuma matrícula encontrada nas faturas da Lytex");
      }

      console.log("Extração de matrículas:", data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Error extracting registrations:", error);
      toast.error(`Erro ao extrair matrículas: ${errorMessage}`);
    } finally {
      setExtractingRegistrations(false);
    }
  };

  const handleFixContributionTypes = async () => {
    if (!currentClinic) return;
    
    // Validar sessão antes de chamar a Edge Function
    const isSessionValid = await validateSession();
    if (!isSessionValid) {
      return;
    }
    
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
        toast.success(`${data.updated} contribuição(ões) atualizada(s) com sucesso!`);
        fetchData();
      } else if (data?.skipped > 0) {
        toast.info(`Nenhuma correção necessária. ${data.skipped} contribuição(ões) já estão corretas.`);
      } else {
        toast.info("Nenhuma contribuição com boleto Lytex encontrada");
      }

      console.log("Correção de tipos:", data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Error fixing contribution types:", error);
      toast.error(`Erro ao corrigir tipos: ${errorMessage}`);
    } finally {
      setFixingTypes(false);
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
          daysBack: null, // Processar TODAS as contribuições pendentes (sem limite de data)
          onlyPending: true, // Apenas contribuições não pagas
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
      
      // Log detalhado para auditoria
      if (data?.skippedDuplicates > 0) {
        console.warn(`[Lytex] ${data.skippedDuplicates} boletos com duplicidade ignorados - revisão manual necessária`);
      }

      console.log("Busca de pagamentos:", data);
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
        },
      });

      if (error) throw error;

      if (data?.imported > 0) {
        toast.success(`${data.imported} boleto(s) externo(s) importado(s) automaticamente! (${data.processedFromPrimary} primária, ${data.processedFromSecondary} secundária)`);
        fetchData();
      } else if (data?.alreadyExists > 0) {
        toast.info(`Todas as ${data.alreadyExists} faturas já existiam no banco`);
      } else {
        toast.info("Nenhuma fatura externa encontrada para importar");
      }

      console.log("Importação externa:", data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Error importing external invoices:", error);
      toast.error(`Erro ao importar faturas externas: ${errorMessage}`);
    } finally {
      setImportingExternal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
            Contribuições Sindicais
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie boletos e contribuições das empresas associadas
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setBulkDialogOpen(true)}
          >
            <FileStack className="h-4 w-4 mr-2" />
            Gerar em Lote
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setOfflineDialogOpen(true)}
            className="text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950"
          >
            <FileX className="h-4 w-4 mr-2" />
            Débitos Retroativos
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
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
            clinicId={currentClinic?.id || ""}
            onOpenNegotiation={(employerId?: string) => {
              setNegotiationEmployerId(employerId);
              setNegotiationDialogOpen(true);
            }}
          />
        </TabsContent>

        <TabsContent value="negotiations">
          <NegotiationInstallmentsTab
            clinicId={currentClinic?.id || ""}
            yearFilter={yearFilter}
          />
        </TabsContent>

        <TabsContent value="types">
          <ContributionTypesTab
            contributionTypes={contributionTypes}
            clinicId={currentClinic?.id || ""}
            onRefresh={fetchData}
          />
        </TabsContent>

        <TabsContent value="reports">
          <ContributionsReportsTab
            contributions={contributions.filter(c => !c.member_id)}
            employers={employers}
            contributionTypes={contributionTypes}
            clinicName={currentClinic?.name}
            clinicLogo={currentClinic?.logo_url || undefined}
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
          />
        </TabsContent>

        <TabsContent value="reports-pf">
          <PFContributionsReportsTab
            contributions={contributions.filter(c => !!c.member_id)}
            contributionTypes={contributionTypes}
            clinicName={currentClinic?.name}
            clinicLogo={currentClinic?.logo_url || undefined}
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
        clinicId={currentClinic?.id || ""}
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
        clinicId={currentClinic?.id || ""}
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
        clinicId={currentClinic?.id || ""}
        userId={session?.user.id || ""}
        onRefresh={fetchData}
      />

      <BulkContributionDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        employers={employers}
        contributionTypes={contributionTypes}
        clinicId={currentClinic?.id || ""}
        userId={session?.user.id || ""}
        onRefresh={fetchData}
        onEnsureYearVisible={setYearFilter}
        categories={categories}
      />

      <OfflineContributionDialog
        open={offlineDialogOpen}
        onOpenChange={setOfflineDialogOpen}
        employers={employers}
        contributionTypes={contributionTypes}
        clinicId={currentClinic?.id || ""}
        userId={session?.user.id || ""}
        onRefresh={fetchData}
        categories={categories}
      />

      <CreateWithoutValueDialog
        open={createWithoutValueDialogOpen}
        onOpenChange={setCreateWithoutValueDialogOpen}
        employers={employers}
        contributionTypes={contributionTypes}
        clinicId={currentClinic?.id || ""}
        userId={session?.user.id || ""}
        onSuccess={fetchData}
        onEnsureYearVisible={setYearFilter}
      />

      <LytexSyncResultsDialog
        open={syncResultsOpen}
        onOpenChange={setSyncResultsOpen}
        result={syncResult}
      />

      {/* Progress overlay during any Lytex action */}
      <LytexSyncProgress 
        syncLogId={currentSyncLogId} 
        isActive={importing || syncing || fixingTypes || extractingRegistrations || fetchingPaid}
        actionType={currentActionType}
      />

      {currentClinic && (
        <LytexConciliationHistoryDialog
          open={historyDialogOpen}
          onOpenChange={setHistoryDialogOpen}
          clinicId={currentClinic.id}
        />
      )}

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
          if (!open) {
            setNegotiationEmployerId(undefined);
          }
        }}
        employers={employers.map(e => ({
          id: e.id,
          name: e.name,
          cnpj: e.cnpj,
          trade_name: e.trade_name,
          registration_number: e.registration_number,
        }))}
        clinicId={currentClinic?.id || ""}
        userId={session?.user.id || ""}
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
