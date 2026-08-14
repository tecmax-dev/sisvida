import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, ArrowLeft, Users, Receipt, FileText, Handshake, Mail, Phone, MapPin, RefreshCw, Search, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useModal } from "@/contexts/ModalContext";
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
  const { updateModalData } = useModal();
  
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
                    const term = (e.target as HTMLInputElement).value.trim().toLowerCase();
                    if (term) {
                      if (isModalMode) {
                        // In modal mode, search for the employer and update modal data
                        supabase
                          .from("employers")
                          .select("id")
                          .eq("clinic_id", currentClinic?.id)
                          .or(`name.ilike.%${term}%,cnpj.ilike.%${term}%,trade_name.ilike.%${term}%`)
                          .limit(1)
                          .maybeSingle()
                          .then(({ data }) => {
                            if (data) {
                              updateModalData('employerEdit', { employerId: data.id, id: data.id });
                            } else {
                              toast.error("Nenhuma empresa encontrada com este termo.");
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
              <TabsList className="flex flex-wrap gap-1.5 bg-transparent h-auto p-0">
                <TabsTrigger 
                  value="contributions" 
                  className="h-8 gap-1.5 px-3 rounded-full bg-slate-50 text-slate-600 data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 data-[state=active]:border-teal-100/50 border border-slate-100/50 text-[11px] font-medium transition-all"
                >
                  <Receipt size={14} /> Contribuições
                </TabsTrigger>
                <TabsTrigger 
                  value="employees" 
                  className="h-8 gap-1.5 px-3 rounded-full bg-slate-50 text-slate-600 data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 data-[state=active]:border-teal-100/50 border border-slate-100/50 text-[11px] font-medium transition-all"
                >
                  <Users size={14} /> Colaboradores
                </TabsTrigger>
                <TabsTrigger 
                  value="negotiations" 
                  className="h-8 gap-1.5 px-3 rounded-full bg-slate-50 text-slate-600 data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 data-[state=active]:border-teal-100/50 border border-slate-100/50 text-[11px] font-medium transition-all"
                >
                  <Handshake size={14} /> Negociações
                </TabsTrigger>
                <TabsTrigger 
                  value="data" 
                  className="h-8 gap-1.5 px-3 rounded-full bg-slate-50 text-slate-600 data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 data-[state=active]:border-teal-100/50 border border-slate-100/50 text-[11px] font-medium transition-all"
                >
                  <FileText size={14} /> Dados
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
