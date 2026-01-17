import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCepLookup } from "@/hooks/useCepLookup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, CheckCircle2, Upload, Settings, ChevronDown } from "lucide-react";

// Schema de validação
const filiacaoSchema = z.object({
  // Dados pessoais
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf: z.string().min(14, "CPF inválido"),
  funcao: z.string().optional(),
  empresa: z.string().optional(),
  vinculo_trabalho: z.string().optional(),
  // Endereço
  cep: z.string().optional(),
  endereco: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  // Dados pessoais adicionais
  data_nascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  sexo: z.string().optional(),
  estado_civil: z.string().optional(),
  nome_pai: z.string().optional(),
  nome_mae: z.string().optional(),
  // Contato
  email: z.string().email("E-mail inválido"),
  celular: z.string().min(14, "Celular inválido"),
  // Pagamento
  forma_pagamento: z.string().optional(),
  // Aceite LGPD
  aceite_lgpd: z.boolean().refine(val => val === true, "Você deve aceitar os termos"),
});

type FiliacaoFormData = z.infer<typeof filiacaoSchema>;

interface UnionEntity {
  id: string;
  razao_social: string;
  cnpj: string;
  logo_url?: string | null;
  entity_type: string;
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

// Componente de campo do formulário estilo SindSystem
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const { lookupCep, loading: cepLoading } = useCepLookup();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sindicato, setSindicato] = useState<UnionEntity | null>(null);
  
  // Upload states
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [uploadingDocFrente, setUploadingDocFrente] = useState(false);
  const [uploadingDocVerso, setUploadingDocVerso] = useState(false);
  const [uploadingComprovante, setUploadingComprovante] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [docFrenteUrl, setDocFrenteUrl] = useState<string | null>(null);
  const [docVersoUrl, setDocVersoUrl] = useState<string | null>(null);
  const [comprovanteUrl, setComprovanteUrl] = useState<string | null>(null);

  const form = useForm<FiliacaoFormData>({
    resolver: zodResolver(filiacaoSchema),
    defaultValues: {
      nome: "",
      cpf: "",
      funcao: "",
      empresa: "",
      vinculo_trabalho: "",
      cep: "",
      endereco: "",
      complemento: "",
      bairro: "",
      cidade: "",
      uf: "",
      data_nascimento: "",
      sexo: "",
      estado_civil: "",
      nome_pai: "",
      nome_mae: "",
      email: "",
      celular: "",
      forma_pagamento: "",
      aceite_lgpd: false,
    },
  });

  // Carregar sindicato
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
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [sindicatoSlug, toast]);

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

  // Upload de arquivo
  const handleFileUpload = async (
    file: File,
    type: "foto" | "doc_frente" | "doc_verso" | "comprovante"
  ) => {
    if (!sindicato) return;

    const setUploading = 
      type === "foto" ? setUploadingFoto : 
      type === "doc_frente" ? setUploadingDocFrente :
      type === "doc_verso" ? setUploadingDocVerso :
      setUploadingComprovante;
    
    const setUrl = 
      type === "foto" ? setFotoUrl : 
      type === "doc_frente" ? setDocFrenteUrl :
      type === "doc_verso" ? setDocVersoUrl :
      setComprovanteUrl;

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${sindicato.id}/${Date.now()}_${type}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("sindical-documentos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("sindical-documentos")
        .getPublicUrl(fileName);

      setUrl(publicUrl);
      toast({
        title: "Arquivo enviado",
        description: "Documento enviado com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error.message || "Não foi possível enviar o arquivo.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Verificar CPF duplicado
  const checkCpfDuplicate = async (cpf: string): Promise<boolean> => {
    if (!sindicato) return false;
    
    const { data } = await supabase
      .from("sindical_associados")
      .select("id")
      .eq("sindicato_id", sindicato.id)
      .eq("cpf", cpf.replace(/\D/g, ""))
      .maybeSingle();

    return !!data;
  };

  // Submeter formulário
  const onSubmit = async (data: FiliacaoFormData) => {
    if (!sindicato) return;

    setSubmitting(true);

    try {
      // Verificar CPF duplicado
      const isDuplicate = await checkCpfDuplicate(data.cpf);
      if (isDuplicate) {
        toast({
          title: "CPF já cadastrado",
          description: "Este CPF já possui uma solicitação de filiação neste sindicato.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Inserir associado
      const { error } = await supabase
        .from("sindical_associados")
        .insert({
          sindicato_id: sindicato.id,
          nome: data.nome,
          cpf: data.cpf.replace(/\D/g, ""),
          cargo: data.funcao || null,
          empresa: data.empresa || null,
          tipo_vinculo: data.vinculo_trabalho || null,
          cep: data.cep?.replace(/\D/g, "") || null,
          logradouro: data.endereco || null,
          complemento: data.complemento || null,
          bairro: data.bairro || null,
          cidade: data.cidade || null,
          uf: data.uf || null,
          data_nascimento: data.data_nascimento,
          sexo: data.sexo || null,
          estado_civil: data.estado_civil || null,
          nome_pai: data.nome_pai || null,
          nome_mae: data.nome_mae || null,
          email: data.email,
          telefone: data.celular.replace(/\D/g, ""),
          forma_pagamento: data.forma_pagamento || null,
          documento_foto_url: fotoUrl,
          documento_rg_url: docFrenteUrl,
          documento_rg_verso_url: docVersoUrl,
          documento_comprovante_url: comprovanteUrl,
          aceite_lgpd: data.aceite_lgpd,
          aceite_lgpd_at: new Date().toISOString(),
          status: "pendente",
        });

      if (error) throw error;

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
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!sindicato) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Card className="max-w-md p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Sindicato não encontrado</h2>
          <p className="text-gray-600">O link de acesso está incorreto ou o sindicato não está disponível.</p>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <Card className="max-w-lg p-8 text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-700 mb-3">
            Solicitação Enviada!
          </h2>
          <p className="text-gray-600 mb-6">
            Sua filiação ao <strong>{sindicato.razao_social}</strong> foi registrada com sucesso.
            Nossa equipe irá analisar sua solicitação e entrar em contato em breve.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Você receberá um e-mail de confirmação com os próximos passos.
          </p>
          <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700">
            Nova Filiação
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header - Estilo SindSystem */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {sindicato.logo_url ? (
                <img 
                  src={sindicato.logo_url} 
                  alt={sindicato.razao_social} 
                  className="h-14 w-auto object-contain"
                />
              ) : (
                <div className="h-14 w-14 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xl font-bold">S</span>
                </div>
              )}
              <div>
                <h1 className="text-lg font-semibold text-gray-800">
                  Formulário de filiação de pessoa física
                </h1>
                <p className="text-sm text-blue-600">
                  {sindicato.razao_social}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Settings className="h-4 w-4" />
              Opções
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </header>

      {/* Formulário */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Card Principal - Dados Cadastrais */}
            <Card className="shadow-sm">
              <CardContent className="p-6 space-y-4">
                
                {/* Linha 1: Nome, CPF */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormFieldInput label="Nome Sócio" required>
                        <Input 
                          placeholder="" 
                          className="h-9 text-sm border-gray-300"
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
                        <Input 
                          placeholder="000.000.000-00" 
                          className="h-9 text-sm border-gray-300"
                          value={field.value}
                          onChange={(e) => field.onChange(formatCpf(e.target.value))}
                        />
                        <FormMessage className="text-xs" />
                      </FormFieldInput>
                    )}
                  />
                </div>

                {/* Linha 2: Função, Empresa */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="funcao"
                    render={({ field }) => (
                      <FormFieldInput label="Função">
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger className="h-9 text-sm border-gray-300">
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
                    name="empresa"
                    render={({ field }) => (
                      <FormFieldInput label="Empresa">
                        <Input 
                          placeholder="Nome da empresa onde trabalha" 
                          className="h-9 text-sm border-gray-300"
                          {...field} 
                        />
                      </FormFieldInput>
                    )}
                  />
                </div>

                {/* Linha 3: Vínculo de Trabalho */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vinculo_trabalho"
                    render={({ field }) => (
                      <FormFieldInput label="Vínculo de Trabalho">
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger className="h-9 text-sm border-gray-300">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="empregado">Empregado (CLT)</SelectItem>
                            <SelectItem value="autonomo">Autônomo</SelectItem>
                            <SelectItem value="temporario">Temporário</SelectItem>
                            <SelectItem value="estagiario">Estagiário</SelectItem>
                            <SelectItem value="jovem_aprendiz">Jovem Aprendiz</SelectItem>
                            <SelectItem value="aposentado">Aposentado</SelectItem>
                            <SelectItem value="desempregado">Desempregado</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormFieldInput>
                    )}
                  />
                </div>

                {/* Separador visual */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-3">Endereço</p>
                </div>

                {/* Linha 4: CEP, Endereço */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="cep"
                    render={({ field }) => (
                      <FormFieldInput label="CEP">
                        <div className="relative">
                          <Input 
                            placeholder="00000-000" 
                            className="h-9 text-sm border-gray-300"
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
                          className="h-9 text-sm border-gray-300"
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
                          className="h-9 text-sm border-gray-300"
                          {...field} 
                        />
                      </FormFieldInput>
                    )}
                  />
                </div>

                {/* Linha 5: Bairro, Cidade, UF */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="bairro"
                    render={({ field }) => (
                      <FormFieldInput label="Bairro">
                        <Input 
                          placeholder="Bairro" 
                          className="h-9 text-sm border-gray-300"
                          {...field} 
                        />
                      </FormFieldInput>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cidade"
                    render={({ field }) => (
                      <FormFieldInput label="Cidade" className="md:col-span-2">
                        <Input 
                          placeholder="Cidade" 
                          className="h-9 text-sm border-gray-300"
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
                          <SelectTrigger className="h-9 text-sm border-gray-300">
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

                {/* Separador visual */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-3">Dados Pessoais</p>
                </div>

                {/* Linha 6: Data Nascimento, Sexo, Estado Civil */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="data_nascimento"
                    render={({ field }) => (
                      <FormFieldInput label="Data de Nascimento" required>
                        <Input 
                          type="date" 
                          className="h-9 text-sm border-gray-300"
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
                          <SelectTrigger className="h-9 text-sm border-gray-300">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="masculino">Masculino</SelectItem>
                            <SelectItem value="feminino">Feminino</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                            <SelectItem value="nao_informar">Prefiro não informar</SelectItem>
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
                          <SelectTrigger className="h-9 text-sm border-gray-300">
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
                </div>

                {/* Linha 7: Nome do Pai, Nome da Mãe */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nome_pai"
                    render={({ field }) => (
                      <FormFieldInput label="Nome do Pai">
                        <Input 
                          placeholder="Nome completo do pai" 
                          className="h-9 text-sm border-gray-300"
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
                          className="h-9 text-sm border-gray-300"
                          {...field} 
                        />
                      </FormFieldInput>
                    )}
                  />
                </div>

                {/* Separador visual */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-3">Contato</p>
                </div>

                {/* Linha 8: E-mail, Celular */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormFieldInput label="E-mail" required>
                        <Input 
                          type="email"
                          placeholder="seu@email.com" 
                          className="h-9 text-sm border-gray-300"
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
                      <FormFieldInput label="Nº Celular" required>
                        <Input 
                          placeholder="(00) 00000-0000" 
                          className="h-9 text-sm border-gray-300"
                          value={field.value}
                          onChange={(e) => field.onChange(formatPhone(e.target.value))}
                        />
                        <FormMessage className="text-xs" />
                      </FormFieldInput>
                    )}
                  />
                </div>

                {/* Separador visual */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-3">Pagamento</p>
                </div>

                {/* Linha 9: Forma de Pagamento */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="forma_pagamento"
                    render={({ field }) => (
                      <FormFieldInput label="Forma de Pagamento">
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger className="h-9 text-sm border-gray-300">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="desconto_folha">Desconto em Folha</SelectItem>
                            <SelectItem value="boleto">Boleto Bancário</SelectItem>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="debito_automatico">Débito Automático</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormFieldInput>
                    )}
                  />
                </div>

              </CardContent>
            </Card>

            {/* Card de Documentos */}
            <Card className="shadow-sm">
              <CardContent className="p-6 space-y-4">
                <p className="text-xs font-medium text-gray-500 uppercase mb-3">Documentos</p>
                
                {/* Uploads */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Foto do Sócio */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">
                      Foto do Sócio (3x4)
                    </Label>
                    <div 
                      className={`
                        border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                        ${fotoUrl ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}
                      `}
                      onClick={() => document.getElementById('upload-foto')?.click()}
                    >
                      {fotoUrl ? (
                        <div className="space-y-1">
                          <img src={fotoUrl} alt="Foto" className="w-16 h-20 object-cover mx-auto rounded" />
                          <p className="text-xs text-green-600 font-medium">Enviado ✓</p>
                        </div>
                      ) : uploadingFoto ? (
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
                      ) : (
                        <div className="space-y-1">
                          <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                          <p className="text-xs text-gray-500">Clique para enviar</p>
                        </div>
                      )}
                    </div>
                    <input 
                      id="upload-foto"
                      type="file" 
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "foto")}
                      disabled={uploadingFoto}
                    />
                  </div>

                  {/* Documento Frente */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">
                      Documento (Frente)
                    </Label>
                    <div 
                      className={`
                        border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors h-[104px] flex items-center justify-center
                        ${docFrenteUrl ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}
                      `}
                      onClick={() => document.getElementById('upload-doc-frente')?.click()}
                    >
                      {docFrenteUrl ? (
                        <div className="space-y-1">
                          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
                          <p className="text-xs text-green-600 font-medium">Enviado ✓</p>
                        </div>
                      ) : uploadingDocFrente ? (
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
                      ) : (
                        <div className="space-y-1">
                          <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                          <p className="text-xs text-gray-500">RG ou CNH</p>
                        </div>
                      )}
                    </div>
                    <input 
                      id="upload-doc-frente"
                      type="file" 
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "doc_frente")}
                      disabled={uploadingDocFrente}
                    />
                  </div>

                  {/* Documento Verso */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">
                      Documento (Verso)
                    </Label>
                    <div 
                      className={`
                        border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors h-[104px] flex items-center justify-center
                        ${docVersoUrl ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}
                      `}
                      onClick={() => document.getElementById('upload-doc-verso')?.click()}
                    >
                      {docVersoUrl ? (
                        <div className="space-y-1">
                          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
                          <p className="text-xs text-green-600 font-medium">Enviado ✓</p>
                        </div>
                      ) : uploadingDocVerso ? (
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
                      ) : (
                        <div className="space-y-1">
                          <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                          <p className="text-xs text-gray-500">Verso do documento</p>
                        </div>
                      )}
                    </div>
                    <input 
                      id="upload-doc-verso"
                      type="file" 
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "doc_verso")}
                      disabled={uploadingDocVerso}
                    />
                  </div>

                  {/* Comprovante de Vínculo */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">
                      Comprovante de Vínculo
                    </Label>
                    <div 
                      className={`
                        border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors h-[104px] flex items-center justify-center
                        ${comprovanteUrl ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}
                      `}
                      onClick={() => document.getElementById('upload-comprovante')?.click()}
                    >
                      {comprovanteUrl ? (
                        <div className="space-y-1">
                          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
                          <p className="text-xs text-green-600 font-medium">Enviado ✓</p>
                        </div>
                      ) : uploadingComprovante ? (
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
                      ) : (
                        <div className="space-y-1">
                          <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                          <p className="text-xs text-gray-500">CTPS ou Holerite</p>
                        </div>
                      )}
                    </div>
                    <input 
                      id="upload-comprovante"
                      type="file" 
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "comprovante")}
                      disabled={uploadingComprovante}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card de Aceite LGPD */}
            <Card className="shadow-sm">
              <CardContent className="p-6">
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
                          da minha filiação.
                          <span className="text-red-500 ml-1">*</span>
                        </FormLabel>
                        <FormMessage className="text-xs" />
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Botão de Envio */}
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 px-8 h-10"
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
      <footer className="bg-white border-t border-gray-200 py-4 mt-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} {sindicato.razao_social}. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
