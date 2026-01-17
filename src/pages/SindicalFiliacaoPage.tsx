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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, CheckCircle2, AlertCircle, Building2, User, Briefcase, MapPin, Phone, CreditCard, FileText, Users, Shield } from "lucide-react";
import { CnpjEmployerSearch } from "@/components/filiacao/CnpjEmployerSearch";
import { DependentsList, Dependent } from "@/components/filiacao/DependentsList";
import { PhotoUploadWithCamera } from "@/components/filiacao/PhotoUploadWithCamera";
import { SignatureCapture } from "@/components/filiacao/SignatureCapture";
import { DocumentUpload } from "@/components/filiacao/DocumentUpload";

// Schema de validação
const filiacaoSchema = z.object({
  // Dados pessoais
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf: z.string().min(14, "CPF inválido"),
  rg: z.string().optional(),
  data_nascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  sexo: z.string().optional(),
  estado_civil: z.string().optional(),
  nome_pai: z.string().optional(),
  nome_mae: z.string().optional(),
  // Endereço
  cep: z.string().optional(),
  endereco: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  // Contato
  email: z.string().email("E-mail inválido"),
  celular: z.string().min(14, "Celular inválido"),
  // Profissional
  funcao: z.string().optional(),
  data_admissao: z.string().optional(),
  // Pagamento
  forma_pagamento: z.string().optional(),
  // Aceite LGPD
  aceite_lgpd: z.boolean().refine(val => val === true, "Você deve aceitar os termos"),
});

type FiliacaoFormData = z.infer<typeof filiacaoSchema>;

interface UnionEntity {
  id: string;
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj: string;
  logo_url?: string | null;
  entity_type: string;
  clinic_id?: string | null;
  allowed_relationship_types?: unknown;
}

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  description?: string | null;
}

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

// Componente de seção
function FormSection({
  icon: Icon,
  title,
  children,
  className = "",
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
        <Icon className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// Componente de campo do formulário
function FormFieldInput({
  label,
  required = false,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-xs font-medium text-gray-600">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [cpfChecking, setCpfChecking] = useState(false);
  const [cpfExists, setCpfExists] = useState(false);
  
  // Dados da empresa
  const [employerData, setEmployerData] = useState<EmployerData | null>(null);
  
  // Dependentes
  const [dependents, setDependents] = useState<Dependent[]>([]);
  
  // Documentos
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [docFrenteUrl, setDocFrenteUrl] = useState<string | null>(null);
  const [docVersoUrl, setDocVersoUrl] = useState<string | null>(null);
  const [comprovanteUrl, setComprovanteUrl] = useState<string | null>(null);
  
  // Assinatura
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

  // Carregar sindicato e métodos de pagamento
  useEffect(() => {
    const loadData = async () => {
      if (!sindicatoSlug) {
        setLoading(false);
        return;
      }

      try {
        // Buscar sindicato
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

        // Buscar métodos de pagamento
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

  // Verificar CPF ao sair do campo
  const checkCpf = async (cpf: string) => {
    if (!sindicato) return;
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) return;

    setCpfChecking(true);
    try {
      const { data } = await supabase
        .from("sindical_associados")
        .select("id, status")
        .eq("sindicato_id", sindicato.id)
        .eq("cpf", cleanCpf)
        .maybeSingle();

      setCpfExists(!!data);
    } finally {
      setCpfChecking(false);
    }
  };

  // Auto-preencher endereço via CEP
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

  // Submeter formulário
  const onSubmit = async (data: FiliacaoFormData) => {
    if (!sindicato) return;

    if (cpfExists) {
      toast({
        title: "CPF já cadastrado",
        description: "Este CPF já possui uma solicitação de filiação neste sindicato.",
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
      // Inserir associado
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
          documento_comprovante_url: comprovanteUrl,
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

      // Inserir dependentes
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!sindicato) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md p-6 text-center">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Sindicato não encontrado</h2>
          <p className="text-gray-600">O link de acesso está incorreto ou o sindicato não está disponível.</p>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-lg p-8 text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-700 mb-3">
            Solicitação Enviada com Sucesso!
          </h2>
          <p className="text-gray-600 mb-4">
            Sua filiação ao <strong>{sindicato.razao_social}</strong> foi registrada.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Nossa equipe irá analisar sua solicitação e entrar em contato através do e-mail ou WhatsApp informados.
            Você receberá a <strong>Ficha de Filiação Digital</strong> após a aprovação.
          </p>
          <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700">
            Nova Filiação
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Institucional */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            {sindicato.logo_url ? (
              <img 
                src={sindicato.logo_url} 
                alt={sindicato.razao_social} 
                className="h-12 w-auto object-contain"
              />
            ) : (
              <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <Building2 className="h-6 w-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-semibold text-gray-800">
                Formulário de Filiação
              </h1>
              <p className="text-sm text-blue-600">
                {sindicato.nome_fantasia || sindicato.razao_social}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Formulário */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Card Principal */}
            <Card className="shadow-sm">
              <CardContent className="p-6 space-y-8">
                
                {/* DADOS PESSOAIS */}
                <FormSection icon={User} title="Dados Pessoais">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="nome"
                      render={({ field }) => (
                        <FormFieldInput label="Nome Completo" required className="md:col-span-2">
                          <Input 
                            placeholder="Nome completo do associado" 
                            className="h-9 text-sm"
                            {...field} 
                          />
                          <FormMessage className="text-xs" />
                        </FormFieldInput>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="cpf"
                      render={({ field }) => (
                        <FormFieldInput label="CPF" required>
                          <div className="relative">
                            <Input 
                              placeholder="000.000.000-00" 
                              className={`h-9 text-sm ${cpfExists ? 'border-red-500' : ''}`}
                              value={field.value}
                              onChange={(e) => field.onChange(formatCpf(e.target.value))}
                              onBlur={(e) => checkCpf(e.target.value)}
                            />
                            {cpfChecking && (
                              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                            )}
                          </div>
                          {cpfExists && (
                            <p className="text-xs text-red-500 mt-1">
                              Este CPF já possui uma solicitação de filiação.
                            </p>
                          )}
                          <FormMessage className="text-xs" />
                        </FormFieldInput>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rg"
                      render={({ field }) => (
                        <FormFieldInput label="RG">
                          <Input 
                            placeholder="Número do RG" 
                            className="h-9 text-sm"
                            {...field} 
                          />
                        </FormFieldInput>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="data_nascimento"
                      render={({ field }) => (
                        <FormFieldInput label="Data de Nascimento" required>
                          <Input 
                            type="date" 
                            className="h-9 text-sm"
                            {...field} 
                          />
                          <FormMessage className="text-xs" />
                        </FormFieldInput>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sexo"
                      render={({ field }) => (
                        <FormFieldInput label="Sexo">
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="masculino">Masculino</SelectItem>
                              <SelectItem value="feminino">Feminino</SelectItem>
                              <SelectItem value="outro">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormFieldInput>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="estado_civil"
                      render={({ field }) => (
                        <FormFieldInput label="Estado Civil">
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                              <SelectItem value="casado">Casado(a)</SelectItem>
                              <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                              <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                              <SelectItem value="uniao_estavel">União Estável</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormFieldInput>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nome_pai"
                      render={({ field }) => (
                        <FormFieldInput label="Nome do Pai">
                          <Input 
                            placeholder="Nome completo do pai" 
                            className="h-9 text-sm"
                            {...field} 
                          />
                        </FormFieldInput>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nome_mae"
                      render={({ field }) => (
                        <FormFieldInput label="Nome da Mãe">
                          <Input 
                            placeholder="Nome completo da mãe" 
                            className="h-9 text-sm"
                            {...field} 
                          />
                        </FormFieldInput>
                      )}
                    />
                  </div>
                </FormSection>

                {/* ENDEREÇO */}
                <FormSection icon={MapPin} title="Endereço">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="cep"
                      render={({ field }) => (
                        <FormFieldInput label="CEP">
                          <div className="relative">
                            <Input 
                              placeholder="00000-000" 
                              className="h-9 text-sm"
                              value={field.value}
                              onChange={(e) => handleCepChange(e.target.value)}
                            />
                            {cepLoading && (
                              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                            )}
                          </div>
                        </FormFieldInput>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endereco"
                      render={({ field }) => (
                        <FormFieldInput label="Endereço" className="md:col-span-2">
                          <Input 
                            placeholder="Rua, Avenida..." 
                            className="h-9 text-sm"
                            {...field} 
                          />
                        </FormFieldInput>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="numero"
                      render={({ field }) => (
                        <FormFieldInput label="Número">
                          <Input 
                            placeholder="Nº" 
                            className="h-9 text-sm"
                            {...field} 
                          />
                        </FormFieldInput>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="complemento"
                      render={({ field }) => (
                        <FormFieldInput label="Complemento">
                          <Input 
                            placeholder="Apto, Bloco..." 
                            className="h-9 text-sm"
                            {...field} 
                          />
                        </FormFieldInput>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bairro"
                      render={({ field }) => (
                        <FormFieldInput label="Bairro">
                          <Input 
                            placeholder="Bairro" 
                            className="h-9 text-sm"
                            {...field} 
                          />
                        </FormFieldInput>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cidade"
                      render={({ field }) => (
                        <FormFieldInput label="Cidade">
                          <Input 
                            placeholder="Cidade" 
                            className="h-9 text-sm"
                            {...field} 
                          />
                        </FormFieldInput>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="uf"
                      render={({ field }) => (
                        <FormFieldInput label="UF">
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="UF" />
                            </SelectTrigger>
                            <SelectContent>
                              {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((uf) => (
                                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormFieldInput>
                      )}
                    />
                  </div>
                </FormSection>

                {/* CONTATO */}
                <FormSection icon={Phone} title="Contato">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormFieldInput label="E-mail" required>
                          <Input 
                            type="email"
                            placeholder="seu@email.com" 
                            className="h-9 text-sm"
                            {...field} 
                          />
                          <FormMessage className="text-xs" />
                        </FormFieldInput>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="celular"
                      render={({ field }) => (
                        <FormFieldInput label="Celular / WhatsApp" required>
                          <Input 
                            placeholder="(00) 00000-0000" 
                            className="h-9 text-sm"
                            value={field.value}
                            onChange={(e) => field.onChange(formatPhone(e.target.value))}
                          />
                          <FormMessage className="text-xs" />
                        </FormFieldInput>
                      )}
                    />
                  </div>
                </FormSection>

                {/* DADOS PROFISSIONAIS */}
                <FormSection icon={Briefcase} title="Dados Profissionais">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="funcao"
                        render={({ field }) => (
                          <FormFieldInput label="Função / Cargo">
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="vendedor">Vendedor(a)</SelectItem>
                                <SelectItem value="caixa">Operador(a) de Caixa</SelectItem>
                                <SelectItem value="repositor">Repositor(a)</SelectItem>
                                <SelectItem value="balconista">Balconista</SelectItem>
                                <SelectItem value="gerente">Gerente</SelectItem>
                                <SelectItem value="supervisor">Supervisor(a)</SelectItem>
                                <SelectItem value="estoquista">Estoquista</SelectItem>
                                <SelectItem value="atendente">Atendente</SelectItem>
                                <SelectItem value="fiscal">Fiscal de Loja</SelectItem>
                                <SelectItem value="outro">Outro</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormFieldInput>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="data_admissao"
                        render={({ field }) => (
                          <FormFieldInput label="Data de Admissão">
                            <Input 
                              type="date" 
                              className="h-9 text-sm"
                              {...field} 
                            />
                          </FormFieldInput>
                        )}
                      />
                    </div>

                    <FormFieldInput label="Empresa onde Trabalha">
                      <CnpjEmployerSearch
                        clinicId={sindicato.clinic_id || undefined}
                        onSelect={setEmployerData}
                      />
                    </FormFieldInput>
                  </div>
                </FormSection>

                {/* DEPENDENTES */}
                <FormSection icon={Users} title="Dependentes (Opcional)">
                  <DependentsList
                    dependents={dependents}
                    onChange={setDependents}
                    allowedRelationshipTypes={
                      Array.isArray(sindicato?.allowed_relationship_types) 
                        ? sindicato.allowed_relationship_types as string[]
                        : null
                    }
                  />
                </FormSection>

                {/* FORMA DE PAGAMENTO */}
                <FormSection icon={CreditCard} title="Forma de Pagamento">
                  <FormField
                    control={form.control}
                    name="forma_pagamento"
                    render={({ field }) => (
                      <FormFieldInput label="Como deseja pagar a contribuição?">
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger className="h-9 text-sm max-w-md">
                            <SelectValue placeholder="Selecione a forma de pagamento..." />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentMethods.length > 0 ? (
                              paymentMethods.map((method) => (
                                <SelectItem key={method.id} value={method.code}>
                                  {method.name}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="desconto_folha">Desconto em Folha</SelectItem>
                                <SelectItem value="boleto">Boleto Bancário</SelectItem>
                                <SelectItem value="pix">PIX</SelectItem>
                                <SelectItem value="debito_automatico">Débito Automático</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </FormFieldInput>
                    )}
                  />
                </FormSection>

              </CardContent>
            </Card>

            {/* Card de Documentos */}
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <FormSection icon={FileText} title="Documentos">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <PhotoUploadWithCamera
                      sindicatoId={sindicato.id}
                      photoUrl={fotoUrl}
                      onUpload={setFotoUrl}
                      onClear={() => setFotoUrl(null)}
                      label="Foto (3x4)"
                    />

                    <DocumentUpload
                      sindicatoId={sindicato.id}
                      documentUrl={docFrenteUrl}
                      onUpload={setDocFrenteUrl}
                      onClear={() => setDocFrenteUrl(null)}
                      label="Documento (Frente)"
                      description="RG ou CNH"
                      type="doc_frente"
                    />

                    <DocumentUpload
                      sindicatoId={sindicato.id}
                      documentUrl={docVersoUrl}
                      onUpload={setDocVersoUrl}
                      onClear={() => setDocVersoUrl(null)}
                      label="Documento (Verso)"
                      description="Verso do RG"
                      type="doc_verso"
                    />

                    <DocumentUpload
                      sindicatoId={sindicato.id}
                      documentUrl={comprovanteUrl}
                      onUpload={setComprovanteUrl}
                      onClear={() => setComprovanteUrl(null)}
                      label="Comprovante de Vínculo"
                      description="CTPS ou Holerite"
                      type="comprovante"
                    />
                  </div>
                </FormSection>
              </CardContent>
            </Card>

            {/* Card de Assinatura Digital */}
            <SignatureCapture
              onSign={setSignatureUrl}
              existingSignature={signatureUrl}
              contributionInfo="2% do menor piso da categoria"
            />

            {/* Card de Aceite LGPD */}
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <FormSection icon={Shield} title="Termos e Condições">
                  <FormField
                    control={form.control}
                    name="aceite_lgpd"
                    render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-0.5"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm text-gray-700 font-normal">
                            Autorizo o tratamento dos meus dados pessoais para fins de filiação sindical, 
                            conforme a Lei Geral de Proteção de Dados (LGPD). Declaro que as informações 
                            prestadas são verdadeiras e que estou ciente dos direitos e deveres decorrentes 
                            da minha filiação ao <strong>{sindicato.razao_social}</strong>.
                            <span className="text-red-500 ml-1">*</span>
                          </FormLabel>
                          <FormMessage className="text-xs" />
                        </div>
                      </FormItem>
                    )}
                  />
                </FormSection>
              </CardContent>
            </Card>

            {/* Botão de Envio */}
            <div className="flex justify-end pb-8">
              <Button 
                type="submit" 
                disabled={submitting || cpfExists}
                className="bg-blue-600 hover:bg-blue-700 px-8 h-11 text-base"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Filiação"
                )}
              </Button>
            </div>

          </form>
        </Form>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} {sindicato.razao_social}. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
