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

// ============ CONVENÇÕES ============
function ConvencoesContent() {
  const [convencoes] = useState([
    { id: "1", title: "CCT 2024/2025 - Comércio", vigencia: "01/05/2024 a 30/04/2025", categoria: "Comerciários", downloadUrl: "#" },
    { id: "2", title: "CCT 2024/2025 - Serviços", vigencia: "01/03/2024 a 28/02/2025", categoria: "Trabalhadores em Serviços", downloadUrl: "#" },
    { id: "3", title: "ACT 2024 - Empresa XYZ", vigencia: "01/01/2024 a 31/12/2024", categoria: "Acordo Coletivo", downloadUrl: "#" },
  ]);

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
                  <p className="text-xs text-muted-foreground mt-1">Vigência: {conv.vigencia}</p>
                  <Badge variant="secondary" className="mt-2 text-xs">{conv.categoria}</Badge>
                </div>
                <Button size="sm" variant="outline" className="ml-2">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ DECLARAÇÕES ============
function DeclaracoesContent() {
  const [solicitando, setSolicitando] = useState(false);
  const { toast } = useToast();

  const tiposDeclaracao = [
    { id: "filiacao", title: "Declaração de Filiação", descricao: "Comprova que você é associado ao sindicato", prazo: "1 dia útil" },
    { id: "contribuicao", title: "Declaração de Contribuições", descricao: "Comprovante de pagamento das contribuições", prazo: "2 dias úteis" },
    { id: "negativa", title: "Certidão Negativa", descricao: "Atesta inexistência de débitos", prazo: "1 dia útil" },
    { id: "tempo_servico", title: "Declaração para Tempo de Serviço", descricao: "Para fins de aposentadoria", prazo: "5 dias úteis" },
  ];

  const handleSolicitar = (tipo: string) => {
    setSolicitando(true);
    setTimeout(() => {
      setSolicitando(false);
      toast({
        title: "Solicitação enviada",
        description: "Você receberá a declaração por e-mail em breve.",
      });
    }, 1500);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Solicite declarações e certidões de forma rápida e prática. Os documentos serão enviados para seu e-mail cadastrado.
      </p>
      <div className="space-y-3">
        {tiposDeclaracao.map((tipo) => (
          <Card key={tipo.id} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm">{tipo.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{tipo.descricao}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Prazo: {tipo.prazo}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSolicitar(tipo.id)}
                  disabled={solicitando}
                  className="ml-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  {solicitando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Solicitar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ CONVÊNIOS ============
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch categories
      const { data: catData } = await supabase
        .from('union_convenio_categories')
        .select('*')
        .eq('is_active', true)
        .order('order_index');
      
      // Fetch convenios
      const { data: convData } = await supabase
        .from('union_convenios')
        .select('*')
        .eq('is_active', true)
        .order('order_index');

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

  const getCategoryInfo = (catId: string) => categorias.find(c => c.id === catId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
function BoletosContent() {
  const [boletos, setBoletos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchBoletos();
  }, []);

  const fetchBoletos = async () => {
    try {
      // Simulated data - in production, fetch from employer_contributions
      setBoletos([
        { id: "1", competencia: "Janeiro/2024", valor: 45.00, vencimento: "2024-01-10", status: "paid", pago_em: "2024-01-08" },
        { id: "2", competencia: "Fevereiro/2024", valor: 45.00, vencimento: "2024-02-10", status: "paid", pago_em: "2024-02-09" },
        { id: "3", competencia: "Março/2024", valor: 45.00, vencimento: "2024-03-10", status: "pending", linha_digitavel: "23793.38128 60000.000003 00000.000405 1 84340000004500" },
      ]);
    } catch (error) {
      console.error("Erro ao buscar boletos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLinhaDigitavel = (boleto: any) => {
    navigator.clipboard.writeText(boleto.linha_digitavel);
    setCopiedId(boleto.id);
    toast({ title: "Linha digitável copiada!" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
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
                  <h4 className="font-semibold text-sm">{boleto.competencia}</h4>
                  <p className="text-xs text-muted-foreground">
                    Vencimento: {format(new Date(boleto.vencimento), "dd/MM/yyyy")}
                  </p>
                </div>
                {getStatusBadge(boleto.status)}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-emerald-600">
                  R$ {boleto.valor.toFixed(2)}
                </span>
                
                {boleto.status === "paid" ? (
                  <span className="text-xs text-muted-foreground">
                    Pago em {format(new Date(boleto.pago_em), "dd/MM/yyyy")}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyLinhaDigitavel(boleto)}
                    className="text-xs"
                  >
                    {copiedId === boleto.id ? (
                      <><CheckCircle2 className="h-4 w-4 mr-1" /> Copiado</>
                    ) : (
                      <><Copy className="h-4 w-4 mr-1" /> Copiar código</>
                    )}
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

// ============ DIRETORIA ============
function DiretoriaContent() {
  const [diretores] = useState([
    { id: "1", nome: "José da Silva", cargo: "Presidente", foto: null },
    { id: "2", nome: "Maria Santos", cargo: "Vice-Presidente", foto: null },
    { id: "3", nome: "João Oliveira", cargo: "Secretário Geral", foto: null },
    { id: "4", nome: "Ana Costa", cargo: "Tesoureira", foto: null },
    { id: "5", nome: "Pedro Lima", cargo: "Diretor Jurídico", foto: null },
    { id: "6", nome: "Lucia Ferreira", cargo: "Diretora Social", foto: null },
  ]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Conheça os membros da diretoria do sindicato que trabalham em defesa dos seus direitos.
      </p>
      
      <div className="grid grid-cols-2 gap-3">
        {diretores.map((diretor) => (
          <Card key={diretor.id} className="border shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                <Users className="h-8 w-8 text-emerald-600" />
              </div>
              <h4 className="font-semibold text-sm">{diretor.nome}</h4>
              <p className="text-xs text-muted-foreground">{diretor.cargo}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ DOCUMENTOS ============
function DocumentosContent() {
  const [documentos] = useState([
    { id: "1", titulo: "Estatuto Social", tipo: "PDF", tamanho: "2.5 MB" },
    { id: "2", titulo: "Regimento Interno", tipo: "PDF", tamanho: "1.2 MB" },
    { id: "3", titulo: "Formulário de Filiação", tipo: "PDF", tamanho: "150 KB" },
    { id: "4", titulo: "Guia do Associado", tipo: "PDF", tamanho: "3.8 MB" },
    { id: "5", titulo: "Tabela Salarial 2024", tipo: "PDF", tamanho: "500 KB" },
  ]);

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
                    <h4 className="font-semibold text-sm">{doc.titulo}</h4>
                    <p className="text-xs text-muted-foreground">{doc.tipo} • {doc.tamanho}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost">
                  <Download className="h-4 w-4" />
                </Button>
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
      const patientId = sessionStorage.getItem('mobile_patient_id');
      const clinicId = sessionStorage.getItem('mobile_clinic_id');
      const patientName = sessionStorage.getItem('mobile_patient_name');

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
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className={`${selectedService.color} text-white p-4 pt-12`}>
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
        <ScrollArea className="flex-1 p-4">
          {renderServiceContent()}
        </ScrollArea>
      </div>
    );
  }

  // Services list view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-emerald-600 text-white p-4 pt-12">
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
      <div className="p-4">
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
