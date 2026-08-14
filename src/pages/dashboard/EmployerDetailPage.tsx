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
  const { currentClinic } = useAuth();
  
  const [employer, setEmployer] = useState<any>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [contributionTypes, setContributionTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedContributionIds, setSelectedContributionIds] = useState<Set<string>>(new Set());

  async function fetchData() {
    if (!id || !currentClinic) return;
    
    try {
      setLoading(true);

      const [empRes, contribRes, typesRes] = await Promise.all([
        supabase.from("employers").select("*").eq("id", id).maybeSingle(),
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

  useEffect(() => {
    if (id && currentClinic) {
      fetchData();
    }
  }, [id, currentClinic]);

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

  if (loading) {
    return <div className="p-8 text-center"><RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-teal-600" /> Carregando...</div>;
  }
  
  if (!employer) return <div className="p-8 text-center">Empresa não encontrada</div>;

  const content = (
    <Tabs defaultValue="contributions" className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            {/* Quick Search for Employers */}
            <div className="mb-6 relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground transition-colors group-focus-within:text-teal-500" />
              <Input
                placeholder="Busca rápida (nome, cnpj)..."
                className="pl-9 h-9 text-[11px] bg-slate-50/50 border-slate-200 focus:bg-white focus:border-teal-500 transition-all rounded-lg"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const term = (e.target as HTMLInputElement).value.trim();
                    if (term) {
                      sessionStorage.setItem("employers_search", term);
                      navigate('/union/empresas');
                    }
                  }
                }}
              />
            </div>

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
              <div className="flex flex-wrap gap-1.5">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    const el = document.querySelector('[data-value="contributions"]') as HTMLElement;
                    el?.click();
                  }}
                  className="h-8 gap-1.5 px-3 rounded-full bg-teal-50 text-teal-700 hover:bg-teal-100 text-[11px] font-medium border border-teal-100/50"
                >
                  <Receipt size={14} /> Contribuições
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    const el = document.querySelector('[data-value="employees"]') as HTMLElement;
                    el?.click();
                  }}
                  className="h-8 gap-1.5 px-3 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 text-[11px] font-medium border border-slate-100/50"
                >
                  <Users size={14} /> Colaboradores
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    const el = document.querySelector('[data-value="negotiations"]') as HTMLElement;
                    el?.click();
                  }}
                  className="h-8 gap-1.5 px-3 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 text-[11px] font-medium border border-slate-100/50"
                >
                  <Handshake size={14} /> Negociações
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    const el = document.querySelector('[data-value="data"]') as HTMLElement;
                    el?.click();
                  }}
                  className="h-8 gap-1.5 px-3 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 text-[11px] font-medium border border-slate-100/50"
                >
                  <FileText size={14} /> Dados
                </Button>
              </div>

              {/* Hidden TabsList for logic */}
              <TabsList className="hidden">
                <TabsTrigger value="contributions" data-value="contributions">C</TabsTrigger>
                <TabsTrigger value="employees" data-value="employees">E</TabsTrigger>
                <TabsTrigger value="negotiations" data-value="negotiations">N</TabsTrigger>
                <TabsTrigger value="data" data-value="data">D</TabsTrigger>
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
