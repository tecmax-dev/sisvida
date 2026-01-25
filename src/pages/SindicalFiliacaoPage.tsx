import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCepLookup } from "@/hooks/useCepLookup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { CpfInputCard } from "@/components/ui/cpf-input-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  User, 
  Briefcase, 
  MapPin, 
  Phone, 
  CreditCard, 
  FileText, 
  Users, 
  Shield,
  Mail,
  Calendar,
  FileImage,
  PenTool,
  Sparkles,
  Heart,
  ArrowRight,
  Check
} from "lucide-react";
import { CnpjEmployerSearch } from "@/components/filiacao/CnpjEmployerSearch";
import { DependentsList, Dependent } from "@/components/filiacao/DependentsList";
import { PhotoUploadWithCamera } from "@/components/filiacao/PhotoUploadWithCamera";
import { SignatureCapture } from "@/components/filiacao/SignatureCapture";
import { DocumentUpload } from "@/components/filiacao/DocumentUpload";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

// Schema de validação
const filiacaoSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf: z.string().min(14, "CPF inválido"),
  rg: z.string().optional(),
  data_nascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  sexo: z.string().optional(),
  estado_civil: z.string().optional(),
  nome_pai: z.string().optional(),
  nome_mae: z.string().optional(),
  cep: z.string().optional(),
  endereco: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  email: z.string().email("E-mail inválido"),
  celular: z.string().min(14, "Celular inválido"),
  funcao: z.string().optional(),
  data_admissao: z.string().optional(),
  forma_pagamento: z.string().optional(),
  aceite_lgpd: z.boolean().refine(val => val === true, "Você deve aceitar os termos"),
});

type FiliacaoFormData = z.infer<typeof filiacaoSchema>;

interface UnionEntity {
  id: string;
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj: string;
  entity_type: string;
  clinic_id?: string | null;
  allowed_relationship_types?: unknown;
}

interface ClinicData {
  id: string;
  name: string;
  logo_url?: string | null;
}

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  description?: string | null;
}

const EXCLUSIVE_PAYMENT_METHODS = ["desconto_folha", "desconto_contracheque"];

interface EmployerData {
  employer_id?: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  endereco?: string;
}

const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  if (numbers.length <= 10) {
    return numbers
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return numbers
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
};

const formatCpf = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  return numbers
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2");
};

const formatCep = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 8);
  return numbers.replace(/(\d{5})(\d)/, "$1-$2");
};

// Stepper steps configuration
const FORM_STEPS = [
  { id: 1, title: "Dados Pessoais", icon: User, description: "Suas informações básicas" },
  { id: 2, title: "Endereço", icon: MapPin, description: "Onde você mora" },
  { id: 3, title: "Contato", icon: Phone, description: "Como falar com você" },
  { id: 4, title: "Profissional", icon: Briefcase, description: "Seu trabalho" },
  { id: 5, title: "Dependentes", icon: Users, description: "Família (opcional)" },
  { id: 6, title: "Documentos", icon: FileImage, description: "Foto e documentos" },
  { id: 7, title: "Finalização", icon: PenTool, description: "Assinatura e aceite" },
];

// Modern Section Component with gradient accent
function FormSection({
  icon: Icon,
  title,
  subtitle,
  children,
  accentColor = "emerald",
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="relative">
      {/* Accent line */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-${accentColor}-500 to-${accentColor}-300 rounded-full`} />
      
      <div className="pl-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl bg-gradient-to-br from-${accentColor}-500 to-${accentColor}-600 text-white shadow-lg shadow-${accentColor}-500/25`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>
        <div className="pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}

// Modern Input Wrapper
function FormInputWrapper({
  label,
  required = false,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

// Progress Stepper Component
function ProgressStepper({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const progress = (currentStep / totalSteps) * 100;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Progresso do formulário</span>
        <span className="font-medium text-emerald-600">{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-2" />
      <p className="text-xs text-gray-500">
        Complete todas as seções para enviar sua filiação
      </p>
    </div>
  );
}

export default function SindicalFiliacaoPage() {
  const { sindicatoSlug } = useParams<{ sindicatoSlug: string }>();
  const { toast } = useToast();
  const { lookupCep, loading: cepLoading } = useCepLookup();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sindicato, setSindicato] = useState<UnionEntity | null>(null);
  const [clinicData, setClinicData] = useState<ClinicData | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [cpfChecking, setCpfChecking] = useState(false);
  const [cpfExists, setCpfExists] = useState(false);
  const [cpfExistsType, setCpfExistsType] = useState<'associado' | 'paciente' | null>(null);
  const [existingPatient, setExistingPatient] = useState<{
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    birth_date?: string | null;
    union_status?: string | null;
    union_card_expires_at?: string | null;
    is_expired?: boolean;
  } | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  
  const [employerData, setEmployerData] = useState<EmployerData | null>(null);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [docFrenteUrl, setDocFrenteUrl] = useState<string | null>(null);
  const [docVersoUrl, setDocVersoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

  const form = useForm<FiliacaoFormData>({
    resolver: zodResolver(filiacaoSchema),
    defaultValues: {
      nome: "",
      cpf: "",
      rg: "",
      data_nascimento: "",
      sexo: "",
      estado_civil: "",
      nome_pai: "",
      nome_mae: "",
      cep: "",
      endereco: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      uf: "",
      email: "",
      celular: "",
      funcao: "",
      data_admissao: "",
      forma_pagamento: "",
      aceite_lgpd: false,
    },
  });

  // Calculate current step based on filled fields
  const watchedFields = form.watch();
  
  useEffect(() => {
    let step = 1;
    if (watchedFields.nome && watchedFields.cpf && watchedFields.data_nascimento) step = 2;
    if (watchedFields.cep || watchedFields.endereco) step = 3;
    if (watchedFields.email && watchedFields.celular) step = 4;
    if (watchedFields.funcao || employerData) step = 5;
    if (dependents.length > 0 || step >= 5) step = 6;
    if (fotoUrl || docFrenteUrl) step = 7;
    setCurrentStep(step);
  }, [watchedFields, employerData, dependents, fotoUrl, docFrenteUrl]);

  useEffect(() => {
    const loadData = async () => {
      if (!sindicatoSlug) {
        setLoading(false);
        return;
      }

      try {
        const { data: sindicatoData, error: sindicatoError } = await supabase
          .from("union_entities")
          .select("*")
          .or(`cnpj.eq.${sindicatoSlug},id.eq.${sindicatoSlug}`)
          .eq("status", "ativa")
          .single();

        if (sindicatoError || !sindicatoData) {
          toast({
            title: "Sindicato não encontrado",
            description: "Verifique o link de acesso.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        setSindicato(sindicatoData);

        // Buscar dados da clínica (para a logo)
        if (sindicatoData.clinic_id) {
          const { data: clinicInfo } = await supabase
            .from("clinics")
            .select("id, name, logo_url")
            .eq("id", sindicatoData.clinic_id)
            .single();

          if (clinicInfo) {
            setClinicData(clinicInfo);
          }
        }

        const { data: methodsData } = await supabase
          .from("sindical_payment_methods")
          .select("*")
          .eq("sindicato_id", sindicatoData.id)
          .eq("is_active", true)
          .order("order_index");

        setPaymentMethods(methodsData || []);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [sindicatoSlug, toast]);

  const checkCpf = async (cpf: string) => {
    if (!sindicato) return;
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) return;

    setCpfChecking(true);
    setCpfExists(false);
    setCpfExistsType(null);
    setExistingPatient(null);
    
    try {
      // 1. Verifica se já existe solicitação de filiação pendente/ativa
      const { data: associadoCheck, error: associadoError } = await supabase.functions.invoke(
        "check-sindical-associado-by-cpf",
        {
          body: { sindicatoId: sindicato.id, cpf: cleanCpf },
        }
      );

      if (!associadoError && associadoCheck?.exists) {
        setCpfExists(true);
        setCpfExistsType('associado');
        toast({
          title: "CPF já possui solicitação",
          description: "Este CPF já possui uma solicitação de filiação. Entre em contato com o sindicato pelo (73) 3231-1784.",
          variant: "destructive",
        });
        return;
      }

      // 2. Busca na base interna de pacientes (patients) usando edge function
      if (sindicato.clinic_id) {
        const { data: patientSearchResult, error: searchError } = await supabase.functions.invoke(
          "search-patient-by-cpf",
          {
            body: { clinicId: sindicato.clinic_id, cpf: cleanCpf },
          }
        );

        if (!searchError && patientSearchResult?.patient?.id) {
          setCpfExists(true);
          setCpfExistsType('paciente');
          toast({
            title: "Você já possui cadastro",
            description: "Este CPF já possui cadastro ativo. Entre em contato com o sindicato pelo (73) 3231-1784.",
            variant: "destructive",
          });
          return;
        }
      }
    } catch (error) {
      console.error("Erro ao verificar CPF:", error);
    } finally {
      setCpfChecking(false);
    }
  };

  const handleCepChange = async (cep: string) => {
    const formattedCep = formatCep(cep);
    form.setValue("cep", formattedCep);
    
    if (cep.replace(/\D/g, "").length === 8) {
      const data = await lookupCep(cep);
      if (data) {
        form.setValue("endereco", data.logradouro);
        form.setValue("bairro", data.bairro);
        form.setValue("cidade", data.localidade);
        form.setValue("uf", data.uf);
      }
    }
  };

  const onSubmit = async (data: FiliacaoFormData) => {
    if (!sindicato) return;

    if (cpfExists) {
      toast({
        title: cpfExistsType === 'paciente' ? "Você já possui cadastro" : "CPF já possui solicitação",
        description:
          cpfExistsType === 'paciente'
            ? "Este CPF já possui cadastro ativo. Entre em contato com o sindicato pelo (73) 3231-1784."
            : "Este CPF já possui uma solicitação de filiação neste sindicato. Entre em contato pelo (73) 3231-1784.",
        variant: "destructive",
      });
      return;
    }

    if (!signatureUrl) {
      toast({
        title: "Assinatura obrigatória",
        description: "Por favor, assine digitalmente para autorizar o desconto.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const { data: associadoData, error: associadoError } = await supabase
        .from("sindical_associados")
        .insert({
          sindicato_id: sindicato.id,
          nome: data.nome,
          cpf: data.cpf.replace(/\D/g, ""),
          rg: data.rg || null,
          data_nascimento: data.data_nascimento,
          sexo: data.sexo || null,
          estado_civil: data.estado_civil || null,
          nome_pai: data.nome_pai || null,
          nome_mae: data.nome_mae || null,
          cep: data.cep?.replace(/\D/g, "") || null,
          logradouro: data.endereco || null,
          numero: data.numero || null,
          complemento: data.complemento || null,
          bairro: data.bairro || null,
          cidade: data.cidade || null,
          uf: data.uf || null,
          email: data.email,
          telefone: data.celular.replace(/\D/g, ""),
          cargo: data.funcao || null,
          data_admissao: data.data_admissao || null,
          employer_id: employerData?.employer_id || null,
          empresa_cnpj: employerData?.cnpj || null,
          empresa_razao_social: employerData?.razao_social || null,
          empresa_nome_fantasia: employerData?.nome_fantasia || null,
          empresa_endereco: employerData?.endereco || null,
          empresa: employerData?.razao_social || null,
          forma_pagamento: data.forma_pagamento || null,
          documento_foto_url: fotoUrl,
          documento_rg_url: docFrenteUrl,
          documento_rg_verso_url: docVersoUrl,
          assinatura_digital_url: signatureUrl,
          assinatura_aceite_desconto: true,
          assinatura_aceite_at: new Date().toISOString(),
          aceite_lgpd: data.aceite_lgpd,
          aceite_lgpd_at: new Date().toISOString(),
          status: "pendente",
        })
        .select("id")
        .single();

      if (associadoError) throw associadoError;

      if (dependents.length > 0 && associadoData) {
        const dependentesInsert = dependents.map(dep => ({
          associado_id: associadoData.id,
          nome: dep.nome,
          grau_parentesco: dep.grau_parentesco,
          data_nascimento: dep.data_nascimento,
          cpf: dep.cpf || null,
        }));

        const { error: depError } = await supabase
          .from("sindical_associado_dependentes")
          .insert(dependentesInsert);

        if (depError) {
          console.error("Erro ao inserir dependentes:", depError);
        }
      }

      setSuccess(true);
      toast({
        title: "Solicitação enviada!",
        description: "Sua filiação foi registrada e será analisada em breve.",
      });
    } catch (error: any) {
      console.error("Erro ao enviar filiação:", error);
      toast({
        title: "Erro ao enviar",
        description: error.message || "Não foi possível enviar sua solicitação.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-200 rounded-full animate-pulse" />
            <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-emerald-600" />
          </div>
          <p className="text-gray-600 font-medium">Carregando formulário...</p>
        </div>
      </div>
    );
  }

  if (!sindicato) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4">
        <Card className="max-w-md p-8 text-center shadow-xl border-0">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Sindicato não encontrado</h2>
          <p className="text-gray-600">O link de acesso está incorreto ou o sindicato não está disponível no momento.</p>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
        <Card className="max-w-lg p-8 text-center shadow-2xl border-0">
          {/* Confetti effect placeholder */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <Sparkles className="absolute top-4 left-4 h-6 w-6 text-amber-400 animate-pulse" />
            <Sparkles className="absolute top-8 right-8 h-4 w-4 text-emerald-400 animate-pulse delay-100" />
            <Sparkles className="absolute bottom-12 left-8 h-5 w-5 text-teal-400 animate-pulse delay-200" />
          </div>
          
          {/* Logo */}
          {clinicData?.logo_url ? (
            <img 
              src={clinicData.logo_url} 
              alt={sindicato.razao_social} 
              className="h-20 w-auto object-contain mx-auto mb-6"
            />
          ) : (
            <div className="h-16 w-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Building2 className="h-8 w-8 text-white" />
            </div>
          )}
          
          {/* Success Icon */}
          <div className="relative mx-auto w-24 h-24 mb-6">
            <div className="absolute inset-0 bg-emerald-200 rounded-full animate-ping opacity-25" />
            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600 mb-4">
            Solicitação Enviada com Sucesso! 🎉
          </h2>
          
          <p className="text-gray-600 mb-4">
            Sua filiação ao <span className="font-semibold text-gray-800">{sindicato.nome_fantasia || sindicato.razao_social}</span> foi registrada.
          </p>
          
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 mb-6 border border-emerald-100">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-white shadow-sm">
                <Mail className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-800">Próximos passos</p>
                <p className="text-xs text-gray-600">
                  Nossa equipe irá analisar sua solicitação e entrar em contato através do e-mail ou WhatsApp informados. Você receberá sua <span className="font-medium">Carteira Digital</span> após a aprovação.
                </p>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={() => window.location.reload()} 
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25"
          >
            <Heart className="h-4 w-4 mr-2" />
            Nova Filiação
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Modern Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            {/* Logo Container */}
            <div className="relative">
              {clinicData?.logo_url ? (
                <img 
                  src={clinicData.logo_url} 
                  alt={sindicato.razao_social} 
                  className="h-14 w-auto object-contain"
                />
              ) : (
                <div className="h-14 w-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <Building2 className="h-7 w-7 text-white" />
                </div>
              )}
              {/* Status badge */}
              <Badge className="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[10px] px-1.5 py-0 shadow">
                Online
              </Badge>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-800 truncate">
                  Filiação Online
                </h1>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-sm text-gray-500 truncate">
                {sindicato.nome_fantasia || sindicato.razao_social}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-100 py-3 px-4">
        <div className="max-w-4xl mx-auto">
          <ProgressStepper currentStep={currentStep} totalSteps={7} />
        </div>
      </div>

      {/* Main Form */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-20">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            {/* Welcome Card */}
            <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-r from-emerald-500 to-teal-600">
              <CardContent className="p-6 text-white">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-white/20 backdrop-blur">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold mb-1">Bem-vindo ao Sindicato! 👋</h2>
                    <p className="text-emerald-100 text-sm">
                      Preencha o formulário abaixo para solicitar sua filiação. É rápido e fácil!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Form Sections */}
            <Card className="shadow-lg border-0">
              <CardContent className="p-6 md:p-8 space-y-10">
                
                {/* CPF DESTACADO - PRIMEIRO CAMPO */}
                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <CpfInputCard
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value);
                          if (value.replace(/\D/g, "").length === 11) {
                            checkCpf(value);
                            } else {
                              setCpfExists(false);
                              setCpfExistsType(null);
                              setExistingPatient(null);
                          }
                        }}
                        label="Digite seu CPF para começar"
                        required
                        loading={cpfChecking}
                        error={cpfExists ? "CPF já possui cadastro" : undefined}
                        className="border-emerald-400 bg-emerald-50/80"
                      />
                      {existingPatient && !cpfExists && (
                        <div className={`mt-3 p-4 rounded-xl border ${existingPatient.is_expired ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                          <div className="flex items-start gap-3">
                            {existingPatient.is_expired ? (
                              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                            ) : (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${existingPatient.is_expired ? 'text-amber-800' : 'text-emerald-800'}`}>
                                {existingPatient.is_expired ? 'Carteira Vencida' : 'Cadastro Encontrado'}
                              </p>
                              <p className="text-sm text-gray-600 mt-0.5">
                                {existingPatient.name}
                                {existingPatient.is_expired && existingPatient.union_card_expires_at && (
                                  <span className="block text-amber-700">
                                    Vencida em: {new Date(existingPatient.union_card_expires_at).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {existingPatient.is_expired 
                                  ? 'Seus dados foram preenchidos. Complete para renovar sua filiação.'
                                  : 'Dados preenchidos automaticamente. Verifique e atualize se necessário.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                {/* DADOS PESSOAIS */}
                <FormSection icon={User} title="Dados Pessoais" subtitle="Conte-nos sobre você" accentColor="emerald">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="nome"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormInputWrapper label="Nome Completo" required hint="Como consta no RG ou CNH">
                            <FormControl>
                              <Input 
                                placeholder="Digite seu nome completo" 
                                className="h-11 rounded-xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormInputWrapper>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rg"
                      render={({ field }) => (
                        <FormItem>
                          <FormInputWrapper label="RG" hint="Número do documento">
                            <FormControl>
                              <Input 
                                placeholder="Número do RG" 
                                className="h-11 rounded-xl border-gray-200 focus:border-emerald-500"
                                {...field} 
                              />
                            </FormControl>
                          </FormInputWrapper>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="data_nascimento"
                      render={({ field }) => (
                        <FormItem>
                          <FormInputWrapper label="Data de Nascimento" required>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type="date" 
                                  className="h-11 rounded-xl border-gray-200 focus:border-emerald-500"
                                  {...field} 
                                />
                                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormInputWrapper>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sexo"
                      render={({ field }) => (
                        <FormItem>
                          <FormInputWrapper label="Sexo">
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11 rounded-xl border-gray-200">
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="masculino">Masculino</SelectItem>
                                <SelectItem value="feminino">Feminino</SelectItem>
                                <SelectItem value="outro">Prefiro não informar</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormInputWrapper>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="estado_civil"
                      render={({ field }) => (
                        <FormItem>
                          <FormInputWrapper label="Estado Civil">
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11 rounded-xl border-gray-200">
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                                <SelectItem value="casado">Casado(a)</SelectItem>
                                <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                                <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                                <SelectItem value="uniao_estavel">União Estável</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormInputWrapper>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nome_pai"
                      render={({ field }) => (
                        <FormItem>
                          <FormInputWrapper label="Nome do Pai" hint="Opcional">
                            <FormControl>
                              <Input 
                                placeholder="Nome completo do pai" 
                                className="h-11 rounded-xl border-gray-200"
                                {...field} 
                              />
                            </FormControl>
                          </FormInputWrapper>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nome_mae"
                      render={({ field }) => (
                        <FormItem>
                          <FormInputWrapper label="Nome da Mãe" hint="Opcional">
                            <FormControl>
                              <Input 
                                placeholder="Nome completo da mãe" 
                                className="h-11 rounded-xl border-gray-200"
                                {...field} 
                              />
                            </FormControl>
                          </FormInputWrapper>
                        </FormItem>
                      )}
                    />
                  </div>
                </FormSection>

                <Separator className="my-8" />

                {/* ENDEREÇO */}
                <FormSection icon={MapPin} title="Endereço" subtitle="Onde você mora" accentColor="blue">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="cep"
                      render={({ field }) => (
                        <FormItem className="col-span-2 md:col-span-1">
                          <FormInputWrapper label="CEP" hint="Digite para buscar">
                            <div className="relative">
                              <FormControl>
                                <Input 
                                  placeholder="00000-000" 
                                  className="h-11 rounded-xl border-gray-200 focus:border-blue-500"
                                  value={field.value}
                                  onChange={(e) => handleCepChange(e.target.value)}
                                />
                              </FormControl>
                              {cepLoading && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                              )}
                            </div>
                          </FormInputWrapper>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endereco"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormInputWrapper label="Endereço">
                            <FormControl>
                              <Input 
                                placeholder="Rua, Avenida..." 
                                className="h-11 rounded-xl border-gray-200"
                                {...field} 
                              />
                            </FormControl>
                          </FormInputWrapper>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="numero"
                      render={({ field }) => (
                        <FormItem>
                          <FormInputWrapper label="Número">
                            <FormControl>
                              <Input 
                                placeholder="Nº" 
                                className="h-11 rounded-xl border-gray-200"
                                {...field} 
                              />
                            </FormControl>
                          </FormInputWrapper>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="complemento"
                      render={({ field }) => (
                        <FormItem>
                          <FormInputWrapper label="Complemento">
                            <FormControl>
                              <Input 
                                placeholder="Apto, Bloco..." 
                                className="h-11 rounded-xl border-gray-200"
                                {...field} 
                              />
                            </FormControl>
                          </FormInputWrapper>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bairro"
                      render={({ field }) => (
                        <FormItem>
                          <FormInputWrapper label="Bairro">
                            <FormControl>
                              <Input 
                                placeholder="Bairro" 
                                className="h-11 rounded-xl border-gray-200"
                                {...field} 
                              />
                            </FormControl>
                          </FormInputWrapper>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cidade"
                      render={({ field }) => (
                        <FormItem>
                          <FormInputWrapper label="Cidade">
                            <FormControl>
                              <Input 
                                placeholder="Cidade" 
                                className="h-11 rounded-xl border-gray-200"
                                {...field} 
                              />
                            </FormControl>
                          </FormInputWrapper>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="uf"
                      render={({ field }) => (
                        <FormItem>
                          <FormInputWrapper label="UF">
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11 rounded-xl border-gray-200">
                                  <SelectValue placeholder="UF" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((uf) => (
                                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormInputWrapper>
                        </FormItem>
                      )}
                    />
                  </div>
                </FormSection>

                <Separator className="my-8" />

                {/* CONTATO */}
                <FormSection icon={Phone} title="Contato" subtitle="Como podemos falar com você" accentColor="violet">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormInputWrapper label="E-mail" required hint="Será usado para notificações">
                            <div className="relative">
                              <FormControl>
                                <Input 
                                  type="email"
                                  placeholder="seu@email.com" 
                                  className="h-11 rounded-xl border-gray-200 focus:border-violet-500 pl-10"
                                  {...field} 
                                />
                              </FormControl>
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            </div>
                            <FormMessage />
                          </FormInputWrapper>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="celular"
                      render={({ field }) => (
                        <FormItem>
                          <FormInputWrapper label="Celular / WhatsApp" required hint="Para envio de avisos">
                            <div className="relative">
                              <FormControl>
                                <Input 
                                  placeholder="(00) 00000-0000" 
                                  className="h-11 rounded-xl border-gray-200 focus:border-violet-500 pl-10"
                                  value={field.value}
                                  onChange={(e) => field.onChange(formatPhone(e.target.value))}
                                />
                              </FormControl>
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            </div>
                            <FormMessage />
                          </FormInputWrapper>
                        </FormItem>
                      )}
                    />
                  </div>
                </FormSection>

                <Separator className="my-8" />

                {/* DADOS PROFISSIONAIS */}
                <FormSection icon={Briefcase} title="Dados Profissionais" subtitle="Informações do seu trabalho" accentColor="amber">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="funcao"
                        render={({ field }) => (
                          <FormItem>
                            <FormInputWrapper label="Função / Cargo">
                              <FormControl>
                                <Input 
                                  placeholder="Sua função na empresa" 
                                  className="h-11 rounded-xl border-gray-200 focus:border-amber-500"
                                  {...field} 
                                />
                              </FormControl>
                            </FormInputWrapper>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="data_admissao"
                        render={({ field }) => (
                          <FormItem>
                            <FormInputWrapper label="Data de Admissão">
                              <FormControl>
                                <div className="relative">
                                  <Input 
                                    type="date" 
                                    className="h-11 rounded-xl border-gray-200 focus:border-amber-500"
                                    {...field} 
                                  />
                                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                </div>
                              </FormControl>
                            </FormInputWrapper>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Employer Search */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-medium text-gray-700">Empresa onde trabalha</span>
                      </div>
                      <CnpjEmployerSearch
                        clinicId={sindicato.clinic_id || ""}
                        onSelect={setEmployerData}
                      />
                      {employerData && (
                        <div className="mt-3 p-3 bg-white rounded-lg border border-amber-200">
                          <p className="text-sm font-medium text-gray-800">{employerData.razao_social}</p>
                          <p className="text-xs text-gray-500">CNPJ: {employerData.cnpj}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </FormSection>

                <Separator className="my-8" />

                {/* DEPENDENTES */}
                <FormSection icon={Users} title="Dependentes" subtitle="Opcional - Adicione familiares" accentColor="pink">
                  <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-4 border border-pink-100">
                    <DependentsList
                      dependents={dependents}
                      onChange={setDependents}
                      allowedRelationshipTypes={
                        Array.isArray(sindicato.allowed_relationship_types)
                          ? (sindicato.allowed_relationship_types as string[])
                          : null
                      }
                    />
                  </div>
                </FormSection>

                <Separator className="my-8" />

                {/* DOCUMENTOS */}
                <FormSection icon={FileImage} title="Documentos" subtitle="Envie sua foto e documentos" accentColor="cyan">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Foto 3x4 */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <User className="h-4 w-4 text-cyan-600" />
                        Foto 3x4
                      </label>
                      <PhotoUploadWithCamera
                        sindicatoId={sindicato.id}
                        photoUrl={fotoUrl}
                        onUpload={setFotoUrl}
                        onClear={() => setFotoUrl(null)}
                      />
                    </div>

                    {/* RG Frente */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-cyan-600" />
                        RG / CNH (Frente)
                      </label>
                      <DocumentUpload
                        sindicatoId={sindicato.id}
                        documentUrl={docFrenteUrl}
                        onUpload={setDocFrenteUrl}
                        onClear={() => setDocFrenteUrl(null)}
                        label="Documento (Frente)"
                        type="rg_frente"
                      />
                    </div>

                    {/* RG Verso */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-cyan-600" />
                        RG / CNH (Verso)
                      </label>
                      <DocumentUpload
                        sindicatoId={sindicato.id}
                        documentUrl={docVersoUrl}
                        onUpload={setDocVersoUrl}
                        onClear={() => setDocVersoUrl(null)}
                        label="Documento (Verso)"
                        type="rg_verso"
                      />
                    </div>
                  </div>
                </FormSection>

                <Separator className="my-8" />

                {/* PAGAMENTO */}
                <FormSection icon={CreditCard} title="Forma de Pagamento" subtitle="Como deseja contribuir" accentColor="emerald">
                  <FormField
                    control={form.control}
                    name="forma_pagamento"
                    render={({ field }) => {
                      // Pré-selecionar "Desconto em Folha" como padrão
                      const payrollMethod = paymentMethods.find(m => 
                        m.code === "desconto_folha" || m.code === "desconto_contracheque"
                      );
                      
                      // Auto-select if only payroll deduction is available OR if it's the default
                      const shouldPreSelect = payrollMethod && !field.value;
                      
                      if (shouldPreSelect) {
                        field.onChange(payrollMethod.code);
                      }

                      const selectedMethod = paymentMethods.find(m => m.code === field.value);
                      const isPayrollDeduction = selectedMethod?.code === "desconto_folha" || 
                        selectedMethod?.code === "desconto_contracheque";

                      return (
                        <FormItem>
                          <div className="space-y-3">
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="h-12 rounded-xl border-gray-200 focus:border-emerald-500">
                                  <SelectValue placeholder="Selecione a forma de pagamento" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {paymentMethods.map((method) => (
                                  <SelectItem key={method.id} value={method.code}>
                                    <div className="flex items-center gap-2">
                                      <CreditCard className="h-4 w-4 text-emerald-600" />
                                      {method.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {isPayrollDeduction && (
                              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200">
                                <div className="flex items-start gap-3">
                                  <div className="p-2 rounded-lg bg-emerald-100">
                                    <Check className="h-4 w-4 text-emerald-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-emerald-800">Desconto em Folha</p>
                                    <p className="text-xs text-emerald-600">
                                      A contribuição será descontada diretamente do seu salário pela empresa.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </FormItem>
                      );
                    }}
                  />
                </FormSection>

                <Separator className="my-8" />

                {/* ASSINATURA E ACEITE */}
                <FormSection icon={PenTool} title="Assinatura Digital" subtitle="Confirme sua filiação" accentColor="indigo">
                  <div className="space-y-6">
                    {/* Signature */}
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                      <div className="flex items-center gap-2 mb-4">
                        <PenTool className="h-4 w-4 text-indigo-600" />
                        <span className="text-sm font-medium text-gray-700">Assine no campo abaixo</span>
                        <span className="text-rose-500">*</span>
                      </div>
                      <SignatureCapture
                        onSign={setSignatureUrl}
                        existingSignature={signatureUrl}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Sua assinatura autoriza o desconto da contribuição sindical conforme a forma de pagamento selecionada.
                      </p>
                    </div>

                    {/* LGPD Acceptance */}
                    <FormField
                      control={form.control}
                      name="aceite_lgpd"
                      render={({ field }) => (
                        <FormItem>
                          <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-4 border border-gray-200">
                            <div className="flex items-start gap-3">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="mt-1"
                                />
                              </FormControl>
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4 text-gray-600" />
                                  <span className="text-sm font-medium text-gray-700">
                                    Aceite de Termos e LGPD <span className="text-rose-500">*</span>
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                  Declaro que li e concordo com os termos de uso e a política de privacidade. 
                                  Autorizo o tratamento dos meus dados pessoais para fins de filiação sindical, 
                                  conforme a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
                                </p>
                              </div>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </FormSection>

              </CardContent>
            </Card>

            {/* Submit Button - Fixed on mobile */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-lg border-t border-gray-100 shadow-lg md:static md:p-0 md:bg-transparent md:border-0 md:shadow-none">
              <Button
                type="submit"
                disabled={submitting || cpfChecking || cpfExists}
                className="w-full h-14 text-lg font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 transition-all duration-300"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Enviando solicitação...
                  </>
                ) : (
                  <>
                    Enviar Filiação
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>
            </div>

          </form>
        </Form>
      </main>
    </div>
  );
}
