import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Building2, ArrowLeft, Users, Receipt, FileText, Handshake, Mail, Phone, MapPin, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import EmployerContributionsTab from "@/components/employers/EmployerContributionsTab";
import NegotiationInstallmentsTab from "@/components/negotiations/NegotiationInstallmentsTab";

export default function EmployerDetailPage({ 
  employerIdOverride, 
  isModalMode 
}: { 
  employerIdOverride?: string; 
  isModalMode?: boolean; 
} = {}) {
  const { id: paramId } = useParams<{ id: string }>();
  const id = employerIdOverride || paramId;
  const navigate = useNavigate();
  const { currentClinic, session } = useAuth();
  const [employer, setEmployer] = useState<any>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [contributionTypes, setContributionTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedContributionIds, setSelectedContributionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id && currentClinic) {
      fetchData();
    }
  }, [id, currentClinic]);

  async function fetchData() {
    try {
      setLoading(true);

      const [empRes, contribRes, typesRes] = await Promise.all([
        supabase.from("employers").select("*").eq("id", id).single(),
        supabase.from("employer_contributions").select("*, contribution_types(*)").eq("employer_id", id).order("due_date", { ascending: false }),
        supabase.from("contribution_types").select("*").eq("clinic_id", currentClinic?.id).eq("is_active", true)
      ]);

      if (empRes.error) throw empRes.error;
      
      setEmployer(empRes.data);
      setContributions(contribRes.data || []);
      setContributionTypes(typesRes.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const total = contributions.length;
    const paid = contributions.filter(c => c.status === 'paid').length;
    const pending = contributions.filter(c => c.status === 'pending').length;
    const overdue = contributions.filter(c => c.status === 'overdue').length;
    const totalValue = contributions.reduce((acc, c) => acc + (c.value || 0), 0);
    const paidValue = contributions.filter(c => c.status === 'paid').reduce((acc, c) => acc + (c.paid_value || c.value || 0), 0);
    
    return {
      total,
      paid,
      pending,
      overdue,
      yearTotal: total,
      totalValue,
      paidValue
    };
  }, [contributions]);

  if (loading) return <div className="p-8 text-center"><RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-teal-600" /> Carregando...</div>;
  if (!employer) return <div className="p-8 text-center">Empresa não encontrada</div>;

  const content = (
    <Tabs defaultValue="contributions" className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-teal-100 p-2 rounded-lg text-teal-600">
                <Building2 size={24} />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-lg leading-tight truncate">{employer.name}</h2>
                <p className="text-xs text-muted-foreground">{employer.cnpj}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-sm">{employer.phone || "N/A"}</div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-sm truncate">{employer.email || "N/A"}</div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-sm">{employer.address ? `${employer.address}, ${employer.city}` : "N/A"}</div>
              </div>
            </div>

            <div className="mt-8">
              <TabsList className="flex flex-col h-auto bg-transparent border-none p-0 gap-1 w-full">
                <TabsTrigger value="contributions" className="w-full justify-start gap-2 px-4 py-3 rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700">
                  <Receipt size={16} /> Contribuições
                </TabsTrigger>
                <TabsTrigger value="employees" className="w-full justify-start gap-2 px-4 py-3 rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700">
                  <Users size={16} /> Colaboradores
                </TabsTrigger>
                <TabsTrigger value="negotiations" className="w-full justify-start gap-2 px-4 py-3 rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700">
                  <Handshake size={16} /> Negociações
                </TabsTrigger>
                <TabsTrigger value="data" className="w-full justify-start gap-2 px-4 py-3 rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700">
                  <FileText size={16} /> Dados Cadastrais
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
        </div>

        <div className="lg:col-span-9">
          <div className="bg-white rounded-xl border shadow-sm min-h-[600px]">
            <TabsContent value="contributions" className="m-0 p-6">
              <EmployerContributionsTab 
                employer={employer}
                contributions={contributions}
                contributionTypes={contributionTypes}
                stats={stats}
                currentClinic={currentClinic}
                syncing={syncing}
                generatingInvoice={false}
                selectedContributionIds={selectedContributionIds}
                setSelectedContributionIds={setSelectedContributionIds}
                onSyncLytex={() => fetchData()}
                onOpenWhatsappDialog={() => {}}
                onOpenEmailDialog={() => {}}
                onOpenCreateDialog={() => {}}
                onOpenOverdueDialog={() => {}}
                onViewContribution={() => {}}
                onGenerateInvoice={() => {}}
                onOpenNegotiationDialog={() => {}}
              />
            </TabsContent>
            <TabsContent value="employees" className="m-0 p-6">
              <div className="text-center py-12 text-muted-foreground">Lista de colaboradores vinculados à empresa.</div>
            </TabsContent>
            <TabsContent value="negotiations" className="m-0 p-6">
              <NegotiationInstallmentsTab 
                employerId={employer.id} 
                clinicId={currentClinic?.id || ""}
              />
            </TabsContent>
            <TabsContent value="data" className="m-0 p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">Razão Social</label>
                  <p className="text-sm">{employer.name}</p>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">CNPJ</label>
                  <p className="text-sm">{employer.cnpj}</p>
                </div>
              </div>
            </TabsContent>
          </div>
        </div>
      </div>
    </Tabs>
  );

  if (isModalMode) return content;

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Button variant="ghost" className="gap-2 -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Voltar para Empresas
        </Button>
        {content}
      </div>
    </div>
  );
}
