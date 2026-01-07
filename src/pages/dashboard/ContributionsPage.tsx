import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Receipt, LayoutDashboard, List, Tag, FileBarChart, Loader2, Download, FileStack, Handshake, Hash, ChevronDown, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { extractFunctionsError } from "@/lib/functionsError";

import ContributionsOverviewTab from "@/components/contributions/ContributionsOverviewTab";
import ContributionsListTab from "@/components/contributions/ContributionsListTab";
import ContributionTypesTab from "@/components/contributions/ContributionTypesTab";
import ContributionsReportsTab from "@/components/contributions/ContributionsReportsTab";
import ContributionDialogs from "@/components/contributions/ContributionDialogs";
import BulkContributionDialog from "@/components/contributions/BulkContributionDialog";
import { LytexSyncResultsDialog, LytexSyncResult } from "@/components/contributions/LytexSyncResultsDialog";
import NegotiationInstallmentsTab from "@/components/negotiations/NegotiationInstallmentsTab";
import { LytexSyncStatusIndicator } from "@/components/contributions/LytexSyncStatusIndicator";
import { LytexSyncProgress, LytexActionType } from "@/components/contributions/LytexSyncProgress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
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
  employers?: Employer;
  contribution_types?: ContributionType;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function ContributionsPage() {
  const { currentClinic, session } = useAuth();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [contributionTypes, setContributionTypes] = useState<ContributionType[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; color: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState("overview");

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [extractingRegistrations, setExtractingRegistrations] = useState(false);
  const [fixingTypes, setFixingTypes] = useState(false);
  const [syncResultsOpen, setSyncResultsOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<LytexSyncResult | null>(null);
  const [currentSyncLogId, setCurrentSyncLogId] = useState<string | null>(null);
  const [currentActionType, setCurrentActionType] = useState<LytexActionType>("import");

  useEffect(() => {
    if (currentClinic) {
      fetchData();
    }
  }, [currentClinic]);

  const fetchData = async () => {
    if (!currentClinic) return;
    setLoading(true);

    try {
      // Fetch contributions with relations
      const { data: contribData, error: contribError } = await supabase
        .from("employer_contributions")
        .select(`
          *,
          employers (id, name, cnpj, email, phone, address, city, state, category_id, registration_number),
          contribution_types (id, name, description, default_value, is_active)
        `)
        .eq("clinic_id", currentClinic.id)
        .order("competence_year", { ascending: false })
        .order("competence_month", { ascending: false })
        .order("created_at", { ascending: false });

      if (contribError) throw contribError;
      setContributions(contribData || []);

      // Fetch employers with category
      const { data: empData, error: empError } = await supabase
        .from("employers")
        .select("id, name, cnpj, email, phone, address, city, state, category_id, registration_number")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");

      if (empError) throw empError;
      setEmployers(empData || []);

      // Fetch categories
      const { data: catData, error: catError } = await supabase
        .from("employer_categories")
        .select("id, name, color")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");

      if (catError) throw catError;
      setCategories(catData || []);

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
    if (!contribution.employers) {
      toast.error("Dados da empresa não encontrados");
      return;
    }

    setGeneratingInvoice(true);
    try {
      const response = await supabase.functions.invoke("lytex-api", {
        body: {
          action: "create_invoice",
          contributionId: contribution.id,
          clinicId: currentClinic?.id,
          employer: {
            cnpj: contribution.employers.cnpj,
            name: contribution.employers.name,
            email: contribution.employers.email,
            phone: contribution.employers.phone,
            address: contribution.employers.address ? {
              street: contribution.employers.address,
              city: contribution.employers.city,
              state: contribution.employers.state,
            } : undefined,
          },
          value: contribution.value,
          dueDate: contribution.due_date,
          description: `${contribution.contribution_types?.name || "Contribuição"} - ${MONTHS[contribution.competence_month - 1]}/${contribution.competence_year}`,
          enableBoleto: true,
          enablePix: true,
        },
      });

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
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
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
            <span className="hidden sm:inline">Relatórios</span>
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
            onSyncAll={handleSyncAll}
            generatingInvoice={generatingInvoice}
            syncing={syncing}
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
            clinicId={currentClinic?.id || ""}
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
            contributions={contributions}
            employers={employers}
            contributionTypes={contributionTypes}
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
      />

      <BulkContributionDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        employers={employers}
        contributionTypes={contributionTypes}
        clinicId={currentClinic?.id || ""}
        userId={session?.user.id || ""}
        onRefresh={fetchData}
        categories={categories}
      />

      <LytexSyncResultsDialog
        open={syncResultsOpen}
        onOpenChange={setSyncResultsOpen}
        result={syncResult}
      />

      {/* Progress overlay during any Lytex action */}
      <LytexSyncProgress 
        syncLogId={currentSyncLogId} 
        isActive={importing || syncing || fixingTypes || extractingRegistrations}
        actionType={currentActionType}
      />
    </div>
  );
}
