import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  FileText,
  Building,
  Receipt,
  Users,
  ClipboardList,
  HeadphonesIcon,
  MessageCircle,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Phone,
  Clock,
  Download,
  ExternalLink,
  Info,
  Loader2,
  Copy,
  CheckCircle2,
  Heart,
  GraduationCap,
  Sparkles,
  Scale,
  AlertTriangle,
  FileCheck,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Service type definitions
type ServiceId = "convencoes" | "declaracoes" | "convenios" | "boletos" | "diretoria" | "documentos" | "atendimentos" | "ouvidoria";

interface ServiceConfig {
  id: ServiceId;
  title: string;
  icon: typeof FileText;
  description: string;
  color: string;
}

const services: ServiceConfig[] = [
  { id: "convencoes", title: "Convenções Coletivas", icon: FileText, description: "Acesse as convenções coletivas vigentes", color: "bg-blue-500" },
  { id: "declaracoes", title: "Declarações", icon: ClipboardList, description: "Solicite declarações e certidões", color: "bg-purple-500" },
  { id: "convenios", title: "Convênios", icon: Building, description: "Parceiros com descontos exclusivos", color: "bg-teal-500" },
  { id: "boletos", title: "Boletos", icon: Receipt, description: "Visualize e pague suas contribuições", color: "bg-amber-500" },
  { id: "diretoria", title: "Diretoria", icon: Users, description: "Conheça nossa diretoria", color: "bg-indigo-500" },
  { id: "documentos", title: "Documentos", icon: FileText, description: "Documentos e formulários úteis", color: "bg-rose-500" },
  { id: "atendimentos", title: "Atendimentos", icon: HeadphonesIcon, description: "Canais de atendimento ao associado", color: "bg-cyan-500" },
  { id: "ouvidoria", title: "Ouvidoria", icon: MessageCircle, description: "Fale conosco, envie sugestões ou reclamações", color: "bg-orange-500" },
];

// ============ CONVENÇÕES - DINÂMICO COM ABAS ============
interface CctCategory {
  id: string;
  name: string;
  color: string;
}

function ConvencoesContent() {
  const [convencoes, setConvencoes] = useState<any[]>([]);
  const [categories, setCategories] = useState<CctCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const clinicId = localStorage.getItem('mobile_clinic_id');
      if (!clinicId) {
        setLoading(false);
        return;
      }

      // Fetch CCT categories
      const { data: catData } = await supabase
        .from("union_cct_categories")
        .select("id, name, color")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      // Fetch convenções
      const { data, error } = await supabase
        .from("union_app_content")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("content_type", "convencao")
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (error) throw error;
      
      setCategories(catData || []);
      setConvencoes(data || []);
      
      // Set first category as active if categories exist
      if (catData && catData.length > 0) {
        setActiveCategory(catData[0].id);
      }
    } catch (err) {
      console.error("Error loading convencoes:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (convencoes.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhuma convenção coletiva cadastrada.
        </p>
      </div>
    );
  }

  // Filter convenções by active category
  const filteredConvencoes = activeCategory 
    ? convencoes.filter(conv => conv.cct_category_id === activeCategory)
    : convencoes;

  // If no categories, show all conventions in simple list
  if (categories.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Consulte as Convenções Coletivas de Trabalho (CCT) e Acordos Coletivos vigentes para sua categoria.
        </p>
        <div className="space-y-3">
          {convencoes.map((conv) => (
            <Card key={conv.id} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{conv.title}</h4>
                    {conv.description && (
                      <p className="text-xs text-muted-foreground mt-1">{conv.description}</p>
                    )}
                    {conv.metadata?.vigencia && (
                      <Badge variant="secondary" className="mt-2 text-xs">{conv.metadata.vigencia}</Badge>
                    )}
                  </div>
                  {conv.file_url && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="ml-2"
                      onClick={() => window.open(conv.file_url, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Consulte as Convenções Coletivas de Trabalho (CCT) e Acordos Coletivos vigentes para sua categoria.
      </p>
      
      {/* Category Tabs */}
      <div className="flex overflow-x-auto gap-1 pb-2 -mx-1 px-1 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-md transition-all flex-shrink-0 ${
              activeCategory === cat.id
                ? "bg-emerald-700 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Convenções List */}
      <div className="space-y-3">
        {filteredConvencoes.length > 0 ? (
          filteredConvencoes.map((conv) => (
            <Card key={conv.id} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{conv.title}</h4>
                    {conv.description && (
                      <p className="text-xs text-muted-foreground mt-1">{conv.description}</p>
                    )}
                    {conv.metadata?.vigencia && (
                      <Badge variant="secondary" className="mt-2 text-xs">{conv.metadata.vigencia}</Badge>
                    )}
                  </div>
                  {conv.file_url && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="ml-2"
                      onClick={() => window.open(conv.file_url, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-6">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma convenção nesta categoria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ DECLARAÇÕES - BASEADO EM BENEFÍCIOS DO SINDICATO ============
function DeclaracoesContent() {
  const navigate = useNavigate();
  const [benefits, setBenefits] = useState<any[]>([]);
  const [activeAuthorizations, setActiveAuthorizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardExpired, setCardExpired] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const clinicId = localStorage.getItem('mobile_clinic_id');
      const patientId = localStorage.getItem('mobile_patient_id');
      
      if (!clinicId || !patientId) {
        setLoading(false);
        return;
      }

      // Fetch benefits from union_benefits
      const { data: benefitsData, error: benefitsError } = await supabase
        .from("union_benefits")
        .select("id, name, description, category, partner_name, validity_days")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (benefitsError) throw benefitsError;
      setBenefits(benefitsData || []);

      // Fetch active authorizations for this patient
      const { data: authData, error: authError } = await supabase
        .from("union_authorizations")
        .select("id, benefit_id, valid_until, status")
        .eq("patient_id", patientId)
        .neq("status", "revoked");

      if (authError) throw authError;
      
      // Filter to only active (not expired)
      const now = new Date();
      const active = (authData || []).filter(auth => {
        const validUntil = new Date(auth.valid_until);
        return validUntil > now;
      });
      setActiveAuthorizations(active);

      // Check if patient card is expired
      const { data: cardData } = await supabase
        .from("patient_cards")
        .select("id, expires_at, is_active")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cardData || (cardData.expires_at && new Date(cardData.expires_at) < now)) {
        setCardExpired(true);
      }

    } catch (err) {
      console.error("Error loading benefits:", err);
    } finally {
      setLoading(false);
    }
  };

  const hasActiveAuthorization = (benefitId: string) => {
    return activeAuthorizations.some(auth => auth.benefit_id === benefitId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (cardExpired) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <h4 className="font-semibold text-red-700 mb-1">Carteirinha Vencida</h4>
        <p className="text-sm text-red-600">
          Sua carteirinha está vencida. Renove para emitir declarações.
        </p>
      </div>
    );
  }

  if (benefits.length === 0) {
    return (
      <div className="text-center py-8">
        <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhum benefício disponível para declaração.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Selecione um benefício para gerar sua declaração. Declarações ativas não podem ser duplicadas.
      </p>
      
      {/* Link to view existing authorizations */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => navigate("/app/autorizacoes")}
      >
        <FileCheck className="h-4 w-4 mr-2" />
        Ver minhas declarações emitidas
      </Button>

      <div className="space-y-3">
        {benefits.map((benefit) => {
          const hasActive = hasActiveAuthorization(benefit.id);
          
          return (
            <Card 
              key={benefit.id} 
              className={`border shadow-sm ${hasActive ? 'opacity-60' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {hasActive && (
                        <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Ativa
                        </Badge>
                      )}
                      {benefit.category && (
                        <Badge variant="outline" className="text-xs">
                          {benefit.category}
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-semibold text-sm">{benefit.name}</h4>
                    {benefit.partner_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Parceiro: {benefit.partner_name}
                      </p>
                    )}
                    {benefit.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {benefit.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Validade: {benefit.validity_days} dias
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={hasActive}
                    onClick={() => navigate("/app/autorizacoes")}
                    className="ml-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {hasActive ? "Emitida" : "Emitir"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============ CONVÊNIOS - DINÂMICO ============
interface ConvenioCategory {
  id: string;
  nome: string;
  icon: string;
  color: string;
}

interface Convenio {
  id: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  category_id: string | null;
}

const iconMap: Record<string, any> = {
  Heart,
  GraduationCap,
  Sparkles,
  Scale,
};

function ConveniosContent() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<ConvenioCategory[]>([]);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [appConvenios, setAppConvenios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const clinicId = localStorage.getItem('mobile_clinic_id');
      if (!clinicId) {
        // Sem clínica selecionada no app mobile, não conseguimos filtrar os convênios.
        setCategorias([]);
        setConvenios([]);
        setAppConvenios([]);
        return;
      }
      
      // Fetch categories
      const { data: catData, error: catError } = await supabase
        .from('union_convenio_categories')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (catError) throw catError;
      
      // Fetch convenios from dedicated table
      const { data: convData, error: convError } = await supabase
        .from('union_convenios')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (convError) throw convError;

      // Fetch convenios from app content (if any)
      const { data: appData, error: appError } = await supabase
        .from("union_app_content")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("content_type", "convenio")
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (appError) throw appError;
      setAppConvenios(appData || []);

      if (catData) setCategorias(catData);
      if (convData) setConvenios(convData);
    } catch (error) {
      console.error('Error fetching convenios:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredConvenios = activeCategory 
    ? convenios.filter(c => c.category_id === activeCategory)
    : [];

  // Convênios sem categoria
  const uncategorizedConvenios = convenios.filter(c => !c.category_id);

  const getCategoryInfo = (catId: string) => categorias.find(c => c.id === catId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Se há convênios sem categoria, mostrar lista direta primeiro
  const allUncategorized = [...uncategorizedConvenios, ...appConvenios];
  
  if (allUncategorized.length > 0 && !activeCategory) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Aproveite descontos exclusivos em nossos parceiros conveniados.
        </p>
        <div className="space-y-3">
          {allUncategorized.map((conv) => (
            <Card key={conv.id} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {(conv.image_url || conv.logo_url) && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={conv.image_url || conv.logo_url} alt={conv.title || conv.nome} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{conv.title || conv.nome}</h4>
                    {(conv.description || conv.descricao) && (
                      <p className="text-xs text-muted-foreground">{conv.description || conv.descricao}</p>
                    )}
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 text-xs shrink-0">
                    Conveniado
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (activeCategory) {
    const catInfo = getCategoryInfo(activeCategory);
    const IconComponent = iconMap[catInfo?.icon || 'Heart'] || Heart;
    
    return (
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setActiveCategory(null)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground -ml-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar às categorias
        </Button>

        <div className={`rounded-xl bg-gradient-to-r ${catInfo?.color || 'from-rose-500 to-pink-500'} p-4 text-white`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <IconComponent className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">{catInfo?.nome}</h3>
              <p className="text-white/80 text-sm">{filteredConvenios.length} parceiro{filteredConvenios.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {filteredConvenios.map((conv) => (
            <Card key={conv.id} className="border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-r ${catInfo?.color || 'from-rose-500 to-pink-500'} bg-opacity-10`}>
                    <IconComponent className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{conv.nome}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{conv.descricao}</p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 text-xs shrink-0">
                    Conveniado
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Se não há convênios
  if (convenios.length === 0 && appConvenios.length === 0) {
    return (
      <div className="text-center py-8">
        <Building className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhum convênio cadastrado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Aproveite descontos exclusivos em nossos parceiros conveniados. Apresente sua carteirinha para obter o benefício.
      </p>
      
      <div className="grid grid-cols-2 gap-3">
        {categorias.map((cat) => {
          const IconComponent = iconMap[cat.icon] || Heart;
          const count = convenios.filter(c => c.category_id === cat.id).length;
          
          return (
            <Card 
              key={cat.id} 
              className="border shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95"
              onClick={() => setActiveCategory(cat.id)}
            >
              <CardContent className="p-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${cat.color} flex items-center justify-center mb-3`}>
                  <IconComponent className="h-6 w-6 text-white" />
                </div>
                <h4 className="font-semibold text-sm">{cat.nome}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {count} parceiro{count !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============ BOLETOS ============
interface BoletoItem {
  id: string;
  competence_month: number;
  competence_year: number;
  value: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  lytex_invoice_url: string | null;
  lytex_boleto_digitable_line: string | null;
  lytex_pix_code: string | null;
  contribution_type_name: string | null;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function BoletosContent() {
  const [boletos, setBoletos] = useState<BoletoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchBoletos();
  }, []);

  const normalizeAndCleanCpf = (cpf: string | null | undefined): string => {
    if (!cpf) return '';
    return cpf.replace(/\D/g, '');
  };

  const fetchBoletos = async () => {
    try {
      const patientId = localStorage.getItem('mobile_patient_id');
      const clinicId = localStorage.getItem('mobile_clinic_id');
      
      if (!patientId || !clinicId) {
        setLoading(false);
        return;
      }

      // 1. Get patient's CPF
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('cpf')
        .eq('id', patientId)
        .single();

      if (patientError) {
        console.error('Error fetching patient CPF:', patientError);
        setLoading(false);
        return;
      }

      const patientCpfClean = normalizeAndCleanCpf(patientData?.cpf);
      
      // We'll collect contributions from multiple sources
      const allContributions: any[] = [];

      // 2. First, try to find member contributions (via members table with matching CPF)
      if (patientCpfClean) {
        const { data: membersData } = await supabase
          .from('members')
          .select('id, cpf')
          .eq('clinic_id', clinicId);

        // Find matching member by normalized CPF
        const matchingMember = membersData?.find(
          (m) => normalizeAndCleanCpf(m.cpf) === patientCpfClean
        );

        if (matchingMember) {
          const { data: memberContributions } = await supabase
            .from('employer_contributions')
            .select(`
              id,
              competence_month,
              competence_year,
              value,
              due_date,
              status,
              paid_at,
              lytex_invoice_url,
              lytex_boleto_digitable_line,
              lytex_pix_code,
              contribution_types:contribution_type_id (name)
            `)
            .eq('member_id', matchingMember.id)
            .in('status', ['pending', 'paid', 'overdue']);

          if (memberContributions) {
            allContributions.push(...memberContributions);
          }
        }
      }

      // 3. Also fetch PF contributions where member_id = patient_id directly
      // (This covers contribuições PF where member_id references patients table)
      const { data: pfContributions } = await supabase
        .from('employer_contributions')
        .select(`
          id,
          competence_month,
          competence_year,
          value,
          due_date,
          status,
          paid_at,
          lytex_invoice_url,
          lytex_boleto_digitable_line,
          lytex_pix_code,
          contribution_types:contribution_type_id (name)
        `)
        .eq('member_id', patientId)
        .in('status', ['pending', 'paid', 'overdue']);

      if (pfContributions) {
        // Avoid duplicates by checking IDs
        const existingIds = new Set(allContributions.map(c => c.id));
        for (const contrib of pfContributions) {
          if (!existingIds.has(contrib.id)) {
            allContributions.push(contrib);
          }
        }
      }

      // Sort by year and month (descending)
      allContributions.sort((a, b) => {
        if (a.competence_year !== b.competence_year) {
          return b.competence_year - a.competence_year;
        }
        return b.competence_month - a.competence_month;
      });

      const formattedBoletos: BoletoItem[] = allContributions.map((c: any) => ({
        id: c.id,
        competence_month: c.competence_month,
        competence_year: c.competence_year,
        value: c.value,
        due_date: c.due_date,
        status: c.status,
        paid_at: c.paid_at,
        lytex_invoice_url: c.lytex_invoice_url,
        lytex_boleto_digitable_line: c.lytex_boleto_digitable_line,
        lytex_pix_code: c.lytex_pix_code,
        contribution_type_name: c.contribution_types?.name || null,
      }));

      setBoletos(formattedBoletos);
    } catch (error) {
      console.error("Erro ao buscar boletos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (boleto: BoletoItem, type: 'digitable' | 'pix') => {
    const code = type === 'pix' ? boleto.lytex_pix_code : boleto.lytex_boleto_digitable_line;
    if (!code) return;
    
    navigator.clipboard.writeText(code);
    setCopiedId(`${boleto.id}-${type}`);
    toast({ title: type === 'pix' ? "Código PIX copiado!" : "Linha digitável copiada!" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const getCompetencia = (month: number, year: number) => {
    return `${MONTH_NAMES[month - 1]}/${year}`;
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    // Check if actually overdue
    const isOverdue = new Date(dueDate) < new Date() && status !== 'paid';
    const displayStatus = isOverdue ? 'overdue' : status;
    
    switch (displayStatus) {
      case "paid":
        return <Badge className="bg-emerald-100 text-emerald-800">Pago</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-800">Pendente</Badge>;
      case "overdue":
        return <Badge className="bg-red-100 text-red-800">Vencido</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (boletos.length === 0) {
    return (
      <div className="text-center py-8">
        <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhum boleto encontrado para seu CPF.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Visualize suas contribuições sindicais e realize pagamentos de forma prática.
      </p>
      
      <div className="space-y-3">
        {boletos.map((boleto) => (
          <Card key={boleto.id} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-sm">
                    {getCompetencia(boleto.competence_month, boleto.competence_year)}
                  </h4>
                  {boleto.contribution_type_name && (
                    <p className="text-xs text-muted-foreground">
                      {boleto.contribution_type_name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Vencimento: {format(new Date(boleto.due_date), "dd/MM/yyyy")}
                  </p>
                </div>
                {getStatusBadge(boleto.status, boleto.due_date)}
              </div>
              
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-bold text-emerald-600">
                  {formatCurrency(boleto.value)}
                </span>
                
                {boleto.status === "paid" && boleto.paid_at && (
                  <span className="text-xs text-muted-foreground">
                    Pago em {format(new Date(boleto.paid_at), "dd/MM/yyyy")}
                  </span>
                )}
              </div>
              
              {/* Action buttons for pending/overdue */}
              {boleto.status !== "paid" && (
                <div className="flex flex-wrap gap-2">
                  {boleto.lytex_invoice_url && (
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => window.open(boleto.lytex_invoice_url!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Pagar
                    </Button>
                  )}
                  
                  {boleto.lytex_boleto_digitable_line && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyCode(boleto, 'digitable')}
                      className="text-xs"
                    >
                      {copiedId === `${boleto.id}-digitable` ? (
                        <><CheckCircle2 className="h-4 w-4 mr-1" /> Copiado</>
                      ) : (
                        <><Copy className="h-4 w-4 mr-1" /> Boleto</>
                      )}
                    </Button>
                  )}
                  
                  {boleto.lytex_pix_code && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyCode(boleto, 'pix')}
                      className="text-xs"
                    >
                      {copiedId === `${boleto.id}-pix` ? (
                        <><CheckCircle2 className="h-4 w-4 mr-1" /> Copiado</>
                      ) : (
                        <><Copy className="h-4 w-4 mr-1" /> PIX</>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ DIRETORIA - DINÂMICO ============
function DiretoriaContent() {
  const [diretores, setDiretores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiretoria();
  }, []);

  const loadDiretoria = async () => {
    try {
      const clinicId = localStorage.getItem('mobile_clinic_id');
      if (!clinicId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("union_app_content")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("content_type", "diretoria")
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setDiretores(data || []);
    } catch (err) {
      console.error("Error loading diretoria:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (diretores.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhum membro da diretoria cadastrado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Conheça os membros da diretoria do sindicato que trabalham em defesa dos seus direitos.
      </p>
      
      <div className="grid grid-cols-2 gap-3">
        {diretores.map((diretor) => (
          <Card key={diretor.id} className="border shadow-sm">
            <CardContent className="p-4 text-center">
              {diretor.image_url ? (
                <div className="w-16 h-16 mx-auto rounded-full overflow-hidden mb-2">
                  <img 
                    src={diretor.image_url} 
                    alt={diretor.title} 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                  <Users className="h-8 w-8 text-emerald-600" />
                </div>
              )}
              <h4 className="font-semibold text-sm">{diretor.title}</h4>
              <p className="text-xs text-muted-foreground">{diretor.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ DOCUMENTOS - DINÂMICO ============
function DocumentosContent() {
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocumentos();
  }, []);

  const loadDocumentos = async () => {
    try {
      const clinicId = localStorage.getItem('mobile_clinic_id');
      if (!clinicId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("union_app_content")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("content_type", "documento")
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setDocumentos(data || []);
    } catch (err) {
      console.error("Error loading documentos:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (documentos.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhum documento cadastrado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Documentos, formulários e materiais úteis para download.
      </p>
      
      <div className="space-y-2">
        {documentos.map((doc) => (
          <Card key={doc.id} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">{doc.title}</h4>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground">{doc.description}</p>
                    )}
                  </div>
                </div>
                {doc.file_url && (
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => window.open(doc.file_url, '_blank')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ ATENDIMENTOS ============
function AtendimentosContent() {
  const canais = [
    { id: "1", titulo: "Atendimento Presencial", descricao: "De segunda a sexta, das 8h às 17h", icone: Building, info: "Rua do Sindicato, 123 - Centro" },
    { id: "2", titulo: "Telefone", descricao: "Central de Atendimento", icone: Phone, info: "(11) 3333-4444" },
    { id: "3", titulo: "WhatsApp", descricao: "Atendimento via mensagem", icone: MessageCircle, info: "(11) 99999-8888" },
    { id: "4", titulo: "Atendimento Jurídico", descricao: "Terças e quintas, das 9h às 12h", icone: ClipboardList, info: "Agendar com antecedência" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Escolha o melhor canal para entrar em contato conosco. Estamos prontos para atendê-lo!
      </p>
      
      <div className="space-y-3">
        {canais.map((canal) => (
          <Card key={canal.id} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <canal.icone className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm">{canal.titulo}</h4>
                  <p className="text-xs text-muted-foreground">{canal.descricao}</p>
                  <p className="text-sm font-medium text-emerald-600 mt-1">{canal.info}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ OUVIDORIA ============
function OuvidoriaContent() {
  const [mensagem, setMensagem] = useState("");
  const [tipo, setTipo] = useState("sugestao");
  const [enviando, setEnviando] = useState(false);
  const [isAnonimo, setIsAnonimo] = useState(false);
  const { toast } = useToast();

  const handleEnviar = async () => {
    if (!mensagem.trim()) {
      toast({ title: "Digite sua mensagem", variant: "destructive" });
      return;
    }

    setEnviando(true);
    
    try {
      const patientId = localStorage.getItem('mobile_patient_id');
      const clinicId = localStorage.getItem('mobile_clinic_id');
      const patientName = localStorage.getItem('mobile_patient_name');

      if (!clinicId) {
        toast({ 
          title: "Erro", 
          description: "Sessão expirada. Faça login novamente.",
          variant: "destructive" 
        });
        return;
      }

      // Buscar dados do paciente se não for anônimo
      let patientData = null;
      if (!isAnonimo && patientId) {
        const { data } = await supabase
          .from("patients")
          .select("name, cpf, phone, email")
          .eq("id", patientId)
          .single();
        patientData = data;
      }

      const { error } = await supabase
        .from("ouvidoria_messages")
        .insert({
          clinic_id: clinicId,
          patient_id: isAnonimo ? null : patientId,
          patient_name: isAnonimo ? null : (patientData?.name || patientName),
          patient_cpf: isAnonimo ? null : patientData?.cpf,
          patient_phone: isAnonimo ? null : patientData?.phone,
          patient_email: isAnonimo ? null : patientData?.email,
          message_type: tipo,
          message: mensagem.trim(),
          is_anonymous: isAnonimo,
        });

      if (error) {
        console.error("Error sending ouvidoria message:", error);
        toast({ 
          title: "Erro ao enviar", 
          description: "Não foi possível enviar sua mensagem. Tente novamente.",
          variant: "destructive" 
        });
        return;
      }

      setMensagem("");
      toast({
        title: "Mensagem enviada!",
        description: "Sua manifestação foi registrada com sucesso. Retornaremos em breve.",
      });
    } catch (err) {
      console.error("Error:", err);
      toast({ 
        title: "Erro", 
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive" 
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        A ouvidoria é um canal direto para você enviar sugestões, elogios, reclamações ou denúncias. 
        Sua identidade pode ser mantida em sigilo, se preferir.
      </p>
      
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Tipo de manifestação</label>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: "sugestao", label: "Sugestão" },
              { value: "elogio", label: "Elogio" },
              { value: "reclamacao", label: "Reclamação" },
              { value: "denuncia", label: "Denúncia" },
            ].map((t) => (
              <Button
                key={t.value}
                size="sm"
                variant={tipo === t.value ? "default" : "outline"}
                onClick={() => setTipo(t.value)}
                className={tipo === t.value ? "bg-emerald-600" : ""}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>
        
        <div>
          <label className="text-sm font-medium mb-2 block">Sua mensagem</label>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Descreva sua manifestação com o máximo de detalhes possível..."
            className="w-full min-h-[120px] p-3 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Opção de anonimato */}
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <input
            type="checkbox"
            id="anonimo"
            checked={isAnonimo}
            onChange={(e) => setIsAnonimo(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <label htmlFor="anonimo" className="text-sm">
            Enviar de forma anônima (sua identidade não será revelada)
          </label>
        </div>
        
        <Button
          onClick={handleEnviar}
          disabled={enviando}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Enviar manifestação
        </Button>
      </div>
    </div>
  );
}

// ============ MAIN PAGE ============
export default function MobileServicesPage() {
  const navigate = useNavigate();
  const { serviceId } = useParams<{ serviceId?: string }>();
  const [selectedService, setSelectedService] = useState<ServiceConfig | null>(null);

  useEffect(() => {
    if (serviceId) {
      const service = services.find((s) => s.id === serviceId);
      setSelectedService(service || null);
    } else {
      setSelectedService(null);
    }
  }, [serviceId]);

  const renderServiceContent = () => {
    if (!selectedService) return null;

    switch (selectedService.id) {
      case "convencoes":
        return <ConvencoesContent />;
      case "declaracoes":
        return <DeclaracoesContent />;
      case "convenios":
        return <ConveniosContent />;
      case "boletos":
        return <BoletosContent />;
      case "diretoria":
        return <DiretoriaContent />;
      case "documentos":
        return <DocumentosContent />;
      case "atendimentos":
        return <AtendimentosContent />;
      case "ouvidoria":
        return <OuvidoriaContent />;
      default:
        return null;
    }
  };

  // Service detail view
  if (selectedService) {
    return (
      <div className="min-h-screen bg-muted flex flex-col">
        {/* Header */}
        <header className={`${selectedService.color} text-white p-4 sticky top-0 z-50`}>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/app/home")}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div className="flex items-center gap-3">
              <selectedService.icon className="h-6 w-6" />
              <h1 className="text-xl font-bold">{selectedService.title}</h1>
            </div>
          </div>
        </header>

        {/* Content */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4">
            {renderServiceContent()}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Services list view
  return (
    <div className="min-h-screen bg-muted flex flex-col">
      {/* Header */}
      <header className="bg-emerald-600 text-white p-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/app/home")}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-bold">Nossos Serviços</h1>
        </div>
      </header>

      {/* Services Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {services.map((service) => (
            <Card
              key={service.id}
              className="border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/app/servicos/${service.id}`)}
            >
              <CardContent className="p-4 text-center">
                <div className={`w-14 h-14 mx-auto ${service.color} rounded-xl flex items-center justify-center mb-3`}>
                  <service.icon className="h-7 w-7 text-white" />
                </div>
                <h4 className="font-semibold text-sm">{service.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{service.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
