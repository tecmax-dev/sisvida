import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Receipt, LayoutDashboard, List, Tag, FileBarChart, Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

import ContributionsOverviewTab from "@/components/contributions/ContributionsOverviewTab";
import ContributionsListTab from "@/components/contributions/ContributionsListTab";
import ContributionTypesTab from "@/components/contributions/ContributionTypesTab";
import ContributionsReportsTab from "@/components/contributions/ContributionsReportsTab";
import ContributionDialogs from "@/components/contributions/ContributionDialogs";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
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
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState("overview");

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);

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
          employers (id, name, cnpj, email, phone, address, city, state),
          contribution_types (id, name, description, default_value, is_active)
        `)
        .eq("clinic_id", currentClinic.id)
        .order("competence_year", { ascending: false })
        .order("competence_month", { ascending: false })
        .order("created_at", { ascending: false });

      if (contribError) throw contribError;
      setContributions(contribData || []);

      // Fetch employers
      const { data: empData, error: empError } = await supabase
        .from("employers")
        .select("id, name, cnpj, email, phone, address, city, state")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");

      if (empError) throw empError;
      setEmployers(empData || []);

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
    try {
      const { data, error } = await supabase.functions.invoke("lytex-api", {
        body: {
          action: "sync_all_pending",
          clinicId: currentClinic.id,
        },
      });

      if (error) throw error;

      if (data?.updated > 0) {
        toast.success(`${data.updated} contribuição(ões) atualizada(s)`);
        fetchData();
      } else {
        toast.info("Nenhuma atualização encontrada");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Error syncing:", error);
      toast.error(`Erro ao sincronizar: ${errorMessage}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleImportFromLytex = async () => {
    if (!currentClinic) return;
    
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("lytex-api", {
        body: {
          action: "import_from_lytex",
          clinicId: currentClinic.id,
        },
      });

      if (error) throw error;

      const imported = (data?.clientsImported || 0) + (data?.invoicesImported || 0);
      const updated = (data?.clientsUpdated || 0) + (data?.invoicesUpdated || 0);

      if (imported > 0 || updated > 0) {
        toast.success(`Importados: ${data?.clientsImported || 0} empresas, ${data?.invoicesImported || 0} boletos. Atualizados: ${updated}`);
        fetchData();
      } else {
        toast.info("Nenhum dado novo encontrado na Lytex");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Error importing:", error);
      toast.error(`Erro ao importar: ${errorMessage}`);
    } finally {
      setImporting(false);
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
        <Button 
          variant="outline" 
          onClick={handleImportFromLytex}
          disabled={importing}
        >
          {importing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {importing ? "Importando..." : "Importar da Lytex"}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="contributions" className="gap-2">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Contribuições</span>
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
    </div>
  );
}
