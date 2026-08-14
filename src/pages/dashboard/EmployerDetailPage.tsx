import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Building2, ArrowLeft, Users, Receipt, FileText, Globe, Handshake, Mail, Phone, MapPin } from "lucide-react";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && currentClinic) {
      fetchEmployer();
    }
  }, [id, currentClinic]);

  async function fetchEmployer() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("employers")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      setEmployer(data);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar empresa");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-8 text-center">Carregando...</div>;
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
              <div>
                <h2 className="font-bold text-lg leading-tight">{employer.name}</h2>
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
              <EmployerContributionsTab employerId={employer.id} />
            </TabsContent>
            <TabsContent value="employees" className="m-0 p-6">
              <div className="text-center py-12 text-muted-foreground">Lista de colaboradores vinculados à empresa.</div>
            </TabsContent>
            <TabsContent value="negotiations" className="m-0 p-6">
              <NegotiationInstallmentsTab employerId={employer.id} />
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
