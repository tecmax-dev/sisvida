import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, ArrowLeft, Users, Receipt, FileText, Handshake, Mail, Phone, MapPin, RefreshCw, Search, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useModal } from "@/contexts/ModalContext";
import { toast } from "sonner";

import EmployerContributionsTab from "@/components/employers/EmployerContributionsTab";
import NegotiationInstallmentsTab from "@/components/negotiations/NegotiationInstallmentsTab";
import ContributionDialogs from "@/components/contributions/ContributionDialogs";

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
  const { currentClinic, user } = useAuth();
  const { updateModalData } = useModal();
  
  const [employer, setEmployer] = useState<any>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [contributionTypes, setContributionTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedContributionIds, setSelectedContributionIds] = useState<Set<string>>(new Set());
  const [selectedContribution, setSelectedContribution] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  const handleGenerateInvoice = async (contribution: any) => {
    if (!currentClinic?.id) {
      toast.error("Clínica não identificada");
      return;
    }
    if (!employer?.cnpj) {
      toast.error("CNPJ da empresa não encontrado");
      return;
    }
    if (!contribution?.value || Number(contribution.value) <= 0) {
      toast.error("Informe o valor da contribuição antes de gerar o boleto");
      return;
    }

    setGeneratingInvoice(true);
    try {
      const body: Record<string, unknown> = {
        action: "create_invoice",
        contributionId: contribution.id,
        clinicId: currentClinic.id,
        value: contribution.value,
        dueDate: contribution.due_date,
        description: `${contribution.contribution_types?.name || "Contribuição"} - ${String(contribution.competence_month).padStart(2, "0")}/${contribution.competence_year}`,
        enableBoleto: true,
        enablePix: true,
        employer: {
          cnpj: employer.cnpj,
          name: employer.name,
          email: employer.email,
          phone: employer.phone,
          address: employer.address
            ? { street: employer.address, city: employer.city, state: employer.state }
            : undefined,
        },
      };

      const { data, error } = await supabase.functions.invoke("lytex-api", { body });
      if (error) throw new Error(error.message);
      if (data && (data as any).error) throw new Error((data as any).error);

      toast.success("Boleto gerado com sucesso!");
      setIsViewDialogOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error("Erro ao gerar boleto:", err);
      toast.error(`Erro ao gerar boleto: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setGeneratingInvoice(false);
    }
  };


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
          <div className="bg-slate-50/50 rounded-2xl border border-slate-200/60 p-6 shadow-sm backdrop-blur-sm">
            {/* Quick Search for Employers */}
            <div className="mb-6 relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-500" />
              <Input
                placeholder="Busca rápida (nome, cnpj)..."
                className="pl-10 h-11 text-xs bg-white border-slate-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all rounded-xl shadow-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const term = (e.target as HTMLInputElement).value.trim().toLowerCase();
                    if (term) {
                      if (isModalMode) {
                        supabase
                          .from("employers")
                          .select("id")
                          .eq("clinic_id", currentClinic?.id)
                          .or(`name.ilike.%${term}%,cnpj.ilike.%${term}%,trade_name.ilike.%${term}%`)
                          .limit(1)
                          .maybeSingle()
                          .then(({ data }) => {
                            if (data) {
                              const newId = data.id;
                              updateModalData('employerEdit', { employerId: newId, id: newId });
                              // Use the navigate-based refresh mechanism since ID changed
                              navigate(`/union/empresas/${newId}`, { replace: true });
                            } else {
                              toast.error("Nenhuma empresa encontrada.");
                            }
                          });
                      } else {
                        sessionStorage.setItem("employers_search", term);
                        navigate('/union/empresas');
                      }
                    }
                  }
                }}
              />
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-3 rounded-2xl text-white shadow-lg shadow-teal-500/20">
                <Building2 size={24} />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-xl text-slate-800 leading-tight truncate">{employer.name}</h2>
                <Badge variant="outline" className="mt-1 bg-white text-slate-500 border-slate-200 font-mono text-[10px] px-1.5 py-0 h-5">
                  {employer.cnpj}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white transition-colors">
                <div className="h-8 w-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                  <Phone className="h-4 w-4" />
                </div>
                <div className="text-[13px] font-medium text-slate-600">{employer.phone || "N/A"}</div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white transition-colors">
                <div className="h-8 w-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="text-[13px] font-medium text-slate-600 truncate">{employer.email || "N/A"}</div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white transition-colors">
                <div className="h-8 w-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="text-[13px] font-medium text-slate-600">{employer.address ? `${employer.address}, ${employer.city}` : "N/A"}</div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-200">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 px-1">Menu</h3>
              <TabsList className="flex flex-wrap gap-2 bg-transparent h-auto p-0">
                {[
                  { value: 'contributions', label: 'Contribuições', icon: Receipt },
                  { value: 'employees', label: 'Colaboradores', icon: Users },
                  { value: 'negotiations', label: 'Negociações', icon: Handshake },
                  { value: 'data', label: 'Dados', icon: FileText },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger 
                      key={tab.value}
                      value={tab.value} 
                      className="h-9 flex items-center gap-2 px-4 rounded-xl text-[11px] font-semibold transition-all duration-200 border bg-white text-slate-600 border-slate-200 hover:border-teal-500/50 hover:bg-teal-50/30 hover:text-teal-700 data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:border-teal-600 data-[state=active]:shadow-md data-[state=active]:shadow-teal-600/20 data-[state=active]:scale-[1.02]"
                    >
                      <Icon size={14} /> {tab.label}
                    </TabsTrigger>
                  );
                })}
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
                generatingInvoice={generatingInvoice}
                selectedContributionIds={selectedContributionIds}
                setSelectedContributionIds={setSelectedContributionIds}
                onSyncLytex={() => fetchData()}
                onOpenWhatsappDialog={() => {}}
                onOpenEmailDialog={() => {}}
                onOpenCreateDialog={() => setIsCreateDialogOpen(true)}
                onOpenOverdueDialog={() => {}}
                onViewContribution={(contrib: any) => {
                  setSelectedContribution(contrib);
                  setIsViewDialogOpen(true);
                }}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold uppercase text-teal-600 mb-4 flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> Informações Básicas
                    </h3>
                    <div className="grid gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Razão Social</Label>
                        <Input 
                          value={employer.name} 
                          onChange={(e) => setEmployer({...employer, name: e.target.value})}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">CNPJ</Label>
                        <Input 
                          value={employer.cnpj} 
                          disabled
                          className="h-9 text-sm bg-slate-50 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Nome Fantasia</Label>
                        <Input 
                          value={employer.trade_name || ""} 
                          onChange={(e) => setEmployer({...employer, trade_name: e.target.value})}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold uppercase text-teal-600 mb-4 flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Contato
                    </h3>
                    <div className="grid gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Email</Label>
                        <Input 
                          value={employer.email || ""} 
                          onChange={(e) => setEmployer({...employer, email: e.target.value})}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Telefone</Label>
                        <Input 
                          value={employer.phone || ""} 
                          onChange={(e) => setEmployer({...employer, phone: e.target.value})}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold uppercase text-teal-600 mb-4 flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Endereço
                    </h3>
                    <div className="grid gap-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1 space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">CEP</Label>
                          <Input 
                            value={employer.cep || ""} 
                            onChange={(e) => setEmployer({...employer, cep: e.target.value})}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Cidade</Label>
                          <Input 
                            value={employer.city || ""} 
                            onChange={(e) => setEmployer({...employer, city: e.target.value})}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Logradouro</Label>
                        <Input 
                          value={employer.address || ""} 
                          onChange={(e) => setEmployer({...employer, address: e.target.value})}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Button 
                      onClick={async () => {
                        try {
                          const { error } = await supabase
                            .from("employers")
                            .update({
                              name: employer.name,
                              trade_name: employer.trade_name,
                              email: employer.email,
                              phone: employer.phone,
                              cep: employer.cep,
                              city: employer.city,
                              address: employer.address
                            })
                            .eq("id", employer.id);
                          
                          if (error) throw error;
                          toast.success("Dados da empresa atualizados");
                        } catch (err) {
                          console.error(err);
                          toast.error("Erro ao salvar alterações");
                        }
                      }}
                      className="w-full bg-teal-600 hover:bg-teal-700"
                    >
                      <Save className="h-4 w-4 mr-2" /> Salvar Alterações
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </div>
      </div>

      <ContributionDialogs
        createDialogOpen={isCreateDialogOpen}
        onCreateDialogChange={setIsCreateDialogOpen}
        employers={[employer]}
        contributionTypes={contributionTypes}
        clinicId={currentClinic?.id || ""}
        userId={user?.id || ""}
        onRefresh={fetchData}
        viewDialogOpen={isViewDialogOpen}
        onViewDialogChange={setIsViewDialogOpen}
        selectedContribution={selectedContribution}
        onGenerateInvoice={handleGenerateInvoice}
        generatingInvoice={generatingInvoice}

      />
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
