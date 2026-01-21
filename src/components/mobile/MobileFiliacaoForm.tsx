import { useState, useEffect } from "react";
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
import { Loader2, CheckCircle2, AlertCircle, User, Briefcase, MapPin, Phone, CreditCard, FileText, Users, Shield, ArrowLeft, UserCircle } from "lucide-react";
import { CpfInputCard } from "@/components/ui/cpf-input-card";
import { CnpjEmployerSearch } from "@/components/filiacao/CnpjEmployerSearch";
import { DependentsList, Dependent } from "@/components/filiacao/DependentsList";
import { PhotoUploadWithCamera } from "@/components/filiacao/PhotoUploadWithCamera";
import { SignatureCapture } from "@/components/filiacao/SignatureCapture";
import { DocumentUpload } from "@/components/filiacao/DocumentUpload";

// ID do sindicato comerciários (hardcoded para este app)
const TARGET_UNION_ENTITY_ID = "74f74e75-6b09-43d5-bf75-41225e085e28";

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
  logo_url?: string | null;
  entity_type: string;
  clinic_id?: string | null;
  allowed_relationship_types?: string[] | null;
}

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  is_exclusive?: boolean;
}

// Payment methods that are exclusive (cannot be combined with others)
// Accept both code variations for payroll deduction
const PAYROLL_DEDUCTION_CODES = ["desconto_contracheque", "desconto_folha"];
const EXCLUSIVE_PAYMENT_METHODS = PAYROLL_DEDUCTION_CODES;

// Incompatible methods when payroll deduction is selected
const INCOMPATIBLE_WITH_PAYROLL = ["pix", "boleto", "dinheiro"];

interface EmployerData {
  employer_id?: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  endereco?: string;
}

interface MobileFiliacaoFormProps {
  onBack?: () => void;
  onSuccess?: () => void;
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

function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
        <Icon className="h-4 w-4 text-emerald-600" />
        <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function MobileFiliacaoForm({ onBack, onSuccess }: MobileFiliacaoFormProps) {
  const { toast } = useToast();
  const { lookupCep, loading: cepLoading } = useCepLookup();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sindicato, setSindicato] = useState<UnionEntity | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [cpfChecking, setCpfChecking] = useState(false);
  const [cpfExists, setCpfExists] = useState(false);
  
  const [employerData, setEmployerData] = useState<EmployerData | null>(null);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [docFrenteUrl, setDocFrenteUrl] = useState<string | null>(null);
  const [docVersoUrl, setDocVersoUrl] = useState<string | null>(null);
  const [comprovanteUrl, setComprovanteUrl] = useState<string | null>(null);
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

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: sindicatoData } = await supabase
          .from("union_entities")
          .select("*")
          .eq("id", TARGET_UNION_ENTITY_ID)
          .eq("status", "ativa")
          .single();

        if (sindicatoData) {
          setSindicato({
            ...sindicatoData,
            allowed_relationship_types: Array.isArray(sindicatoData.allowed_relationship_types)
              ? sindicatoData.allowed_relationship_types as string[]
              : null
          });

          const { data: methodsData } = await supabase
            .from("sindical_payment_methods")
            .select("*")
            .eq("sindicato_id", sindicatoData.id)
            .eq("is_active", true)
            .order("order_index");

          setPaymentMethods(methodsData || []);
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

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
        title: "CPF já cadastrado",
        description: "Este CPF já possui uma solicitação de filiação.",
        variant: "destructive",
      });
      return;
    }

    if (!signatureUrl) {
      toast({
        title: "Assinatura obrigatória",
        description: "Por favor, assine digitalmente para autorizar.",
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

      if (dependents.length > 0 && associadoData) {
        const dependentesInsert = dependents.map(dep => ({
          associado_id: associadoData.id,
          nome: dep.nome,
          grau_parentesco: dep.grau_parentesco,
          data_nascimento: dep.data_nascimento,
          cpf: dep.cpf || null,
        }));

        await supabase
          .from("sindical_associado_dependentes")
          .insert(dependentesInsert);
      }

      setSuccess(true);
      toast({
        title: "Solicitação enviada!",
        description: "Sua filiação foi registrada e será analisada.",
      });
      onSuccess?.();
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

  const handleNewFiliacao = () => {
    setSuccess(false);
    form.reset();
    setEmployerData(null);
    setDependents([]);
    setFotoUrl(null);
    setDocFrenteUrl(null);
    setDocVersoUrl(null);
    setComprovanteUrl(null);
    setSignatureUrl(null);
    setCpfExists(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!sindicato) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Sindicato não encontrado</h2>
          <p className="text-gray-600 mb-4">O sindicato não está disponível no momento.</p>
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          )}
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="p-6 text-center max-w-lg">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-green-700 mb-3">
            Solicitação Enviada!
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Sua filiação ao <strong>{sindicato.nome_fantasia || sindicato.razao_social}</strong> foi registrada.
          </p>
          <p className="text-xs text-gray-500 mb-6">
            Nossa equipe irá analisar sua solicitação e entrará em contato.
          </p>
          <div className="flex gap-2 justify-center">
            {onBack && (
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            )}
            <Button onClick={handleNewFiliacao} className="bg-emerald-600 hover:bg-emerald-700">
              Nova Filiação
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header com botão voltar */}
      {onBack && (
        <div className="mb-4">
          <Button variant="ghost" onClick={onBack} className="text-gray-600 hover:text-gray-800 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      )}

      {/* Logo e título */}
      <div className="text-center mb-6">
        {sindicato.logo_url && (
          <img 
            src={sindicato.logo_url} 
            alt={sindicato.nome_fantasia || sindicato.razao_social}
            className="h-16 mx-auto mb-3 object-contain"
          />
        )}
        <h1 className="text-xl font-bold text-gray-800">Filiação Online</h1>
        <p className="text-sm text-gray-600">{sindicato.nome_fantasia || sindicato.razao_social}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          
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
                    }
                  }}
                  label="Digite seu CPF para começar"
                  required
                  loading={cpfChecking}
                  error={cpfExists ? "CPF já possui cadastro" : undefined}
                  className="border-emerald-400 bg-emerald-50/80"
                />
              </FormItem>
            )}
          />

          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-6">
              
              {/* DADOS PESSOAIS */}
              <FormSection icon={User} title="Dados Pessoais">
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Nome Completo *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Seu nome completo" className="text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="rg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">RG</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="RG" className="text-sm" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="data_nascimento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Data Nasc. *</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" className="text-sm" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="sexo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Sexo</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="text-sm">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="masculino">Masculino</SelectItem>
                              <SelectItem value="feminino">Feminino</SelectItem>
                              <SelectItem value="outro">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="estado_civil"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Estado Civil</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="text-sm">
                                <SelectValue placeholder="Selecione" />
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
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="nome_mae"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Nome da Mãe</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nome completo da mãe" className="text-sm" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>

              {/* CONTATO */}
              <FormSection icon={Phone} title="Contato">
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">E-mail *</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="seu@email.com" className="text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="celular"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Celular/WhatsApp *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="(00) 00000-0000"
                            className="text-sm"
                            onChange={(e) => field.onChange(formatPhone(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>

              {/* ENDEREÇO */}
              <FormSection icon={MapPin} title="Endereço">
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="cep"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">CEP</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="00000-000"
                            className="text-sm"
                            onChange={(e) => handleCepChange(e.target.value)}
                          />
                        </FormControl>
                        {cepLoading && <span className="text-xs text-gray-500">Buscando...</span>}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endereco"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Logradouro</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Rua, Avenida..." className="text-sm" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <FormField
                      control={form.control}
                      name="numero"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Nº</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nº" className="text-sm" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bairro"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel className="text-xs">Bairro</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Bairro" className="text-sm" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <FormField
                      control={form.control}
                      name="cidade"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel className="text-xs">Cidade</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Cidade" className="text-sm" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="uf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">UF</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="UF" className="text-sm" maxLength={2} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </FormSection>

              {/* EMPRESA */}
              <FormSection icon={Briefcase} title="Dados Profissionais">
                <div className="space-y-3">
                  <CnpjEmployerSearch
                    clinicId={sindicato.clinic_id || undefined}
                    onSelect={(employer) => setEmployerData(employer)}
                  />

                  <FormField
                    control={form.control}
                    name="funcao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Função/Cargo</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Sua função na empresa" className="text-sm" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="data_admissao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Data de Admissão</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" className="text-sm" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>

              {/* PAGAMENTO */}
              {paymentMethods.length > 0 && (
                <FormSection icon={CreditCard} title="Forma de Pagamento da Contribuição">
                  <FormField
                    control={form.control}
                    name="forma_pagamento"
                    render={({ field }) => {
                      // If only one payment method and it's payroll deduction, pre-select it
                      const isFirstMethodPayroll = paymentMethods.length === 1 && 
                        PAYROLL_DEDUCTION_CODES.includes(paymentMethods[0].code);
                      
                      // Auto-select if should pre-select and no value set
                      if (isFirstMethodPayroll && !field.value) {
                        field.onChange(paymentMethods[0].code);
                      }

                      const selectedMethod = paymentMethods.find(m => m.code === field.value);
                      const isPayrollDeduction = selectedMethod && PAYROLL_DEDUCTION_CODES.includes(selectedMethod.code);
                      
                      return (
                        <FormItem>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="text-sm">
                                <SelectValue placeholder="Selecione a forma de pagamento" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {paymentMethods.map((method) => (
                                <SelectItem key={method.id} value={method.code}>
                                  {method.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isPayrollDeduction && (
                            <p className="text-xs text-amber-600 mt-2">
                              Ao selecionar esta opção, o valor será descontado diretamente do seu contracheque/folha de pagamento.
                            </p>
                          )}
                        </FormItem>
                      );
                    }}
                  />
                </FormSection>
              )}

              {/* DEPENDENTES */}
              <FormSection icon={Users} title="Dependentes">
                <DependentsList
                  dependents={dependents}
                  onChange={setDependents}
                  allowedRelationshipTypes={sindicato.allowed_relationship_types}
                />
              </FormSection>

              {/* DOCUMENTOS */}
              <FormSection icon={FileText} title="Documentos">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Foto 3x4</p>
                    <PhotoUploadWithCamera
                      sindicatoId={sindicato.id}
                      photoUrl={fotoUrl}
                      onUpload={setFotoUrl}
                      onClear={() => setFotoUrl(null)}
                    />
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Documento (Frente)</p>
                    <DocumentUpload
                      sindicatoId={sindicato.id}
                      label="RG/CNH Frente"
                      type="doc_frente"
                      documentUrl={docFrenteUrl}
                      onUpload={setDocFrenteUrl}
                      onClear={() => setDocFrenteUrl(null)}
                    />
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Documento (Verso)</p>
                    <DocumentUpload
                      sindicatoId={sindicato.id}
                      label="RG/CNH Verso"
                      type="doc_verso"
                      documentUrl={docVersoUrl}
                      onUpload={setDocVersoUrl}
                      onClear={() => setDocVersoUrl(null)}
                    />
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Comprovante de Residência</p>
                    <DocumentUpload
                      sindicatoId={sindicato.id}
                      label="Comprovante"
                      type="comprovante"
                      documentUrl={comprovanteUrl}
                      onUpload={setComprovanteUrl}
                      onClear={() => setComprovanteUrl(null)}
                    />
                  </div>
                </div>
              </FormSection>

              {/* ASSINATURA */}
              <FormSection icon={Shield} title="Assinatura Digital">
                <div className="space-y-3">
                  <p className="text-xs text-gray-600">
                    Autorizo o desconto em folha de pagamento referente à mensalidade sindical.
                  </p>
                  <SignatureCapture
                    onSign={setSignatureUrl}
                    existingSignature={signatureUrl}
                  />
                </div>
              </FormSection>

              {/* LGPD */}
              <FormField
                control={form.control}
                name="aceite_lgpd"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-xs">
                        Aceito os termos de uso e política de privacidade (LGPD) *
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={submitting || cpfExists}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Filiação"
                )}
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
