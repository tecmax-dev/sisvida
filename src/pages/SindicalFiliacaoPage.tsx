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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CpfInputCard } from "@/components/ui/cpf-input-card";
import { Loader2, CheckCircle2, UserPlus, Building2, MapPin, Briefcase, CreditCard, FileText, Shield } from "lucide-react";

// Schema de validação
const filiacaoSchema = z.object({
  // Dados pessoais
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf: z.string().min(14, "CPF inválido"),
  rg: z.string().optional(),
  data_nascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  sexo: z.string().optional(),
  estado_civil: z.string().optional(),
  // Contato
  telefone: z.string().min(14, "Telefone inválido"),
  email: z.string().email("E-mail inválido"),
  // Endereço
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  // Dados profissionais
  empresa: z.string().optional(),
  cargo: z.string().optional(),
  tipo_vinculo: z.string().optional(),
  // Filiação
  categoria_id: z.string().optional(),
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

interface Categoria {
  id: string;
  nome: string;
  descricao: string | null;
  valor_contribuicao: number;
  periodicidade: string;
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

const formatCep = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 8);
  return numbers.replace(/(\d{5})(\d)/, "$1-$2");
};

export default function SindicalFiliacaoPage() {
  const { sindicatoSlug } = useParams<{ sindicatoSlug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { lookupCep, loading: cepLoading } = useCepLookup();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sindicato, setSindicato] = useState<UnionEntity | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [selectedCategoria, setSelectedCategoria] = useState<Categoria | null>(null);
  
  // Upload states
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [uploadingRg, setUploadingRg] = useState(false);
  const [uploadingComprovante, setUploadingComprovante] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [rgUrl, setRgUrl] = useState<string | null>(null);
  const [comprovanteUrl, setComprovanteUrl] = useState<string | null>(null);

  const form = useForm<FiliacaoFormData>({
    resolver: zodResolver(filiacaoSchema),
    defaultValues: {
      nome: "",
      cpf: "",
      rg: "",
      data_nascimento: "",
      sexo: "",
      estado_civil: "",
      telefone: "",
      email: "",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      uf: "",
      empresa: "",
      cargo: "",
      tipo_vinculo: "",
      categoria_id: "",
      forma_pagamento: "",
      aceite_lgpd: false,
    },
  });

  // Carregar sindicato e categorias
  useEffect(() => {
    const loadData = async () => {
      if (!sindicatoSlug) {
        setLoading(false);
        return;
      }

      try {
        // Buscar sindicato pelo slug (usando cnpj como slug temporário)
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

        // Buscar categorias ativas
        const { data: categoriasData } = await supabase
          .from("sindical_categorias")
          .select("*")
          .eq("sindicato_id", sindicatoData.id)
          .eq("is_active", true)
          .order("nome");

        setCategorias(categoriasData || []);
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
        form.setValue("logradouro", data.logradouro);
        form.setValue("bairro", data.bairro);
        form.setValue("cidade", data.localidade);
        form.setValue("uf", data.uf);
      }
    }
  };

  // Upload de arquivo
  const handleFileUpload = async (
    file: File,
    type: "foto" | "rg" | "comprovante"
  ) => {
    if (!sindicato) return;

    const setUploading = type === "foto" ? setUploadingFoto : type === "rg" ? setUploadingRg : setUploadingComprovante;
    const setUrl = type === "foto" ? setFotoUrl : type === "rg" ? setRgUrl : setComprovanteUrl;

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
          rg: data.rg || null,
          data_nascimento: data.data_nascimento,
          sexo: data.sexo || null,
          estado_civil: data.estado_civil || null,
          telefone: data.telefone.replace(/\D/g, ""),
          email: data.email,
          cep: data.cep?.replace(/\D/g, "") || null,
          logradouro: data.logradouro || null,
          numero: data.numero || null,
          complemento: data.complemento || null,
          bairro: data.bairro || null,
          cidade: data.cidade || null,
          uf: data.uf || null,
          empresa: data.empresa || null,
          cargo: data.cargo || null,
          tipo_vinculo: data.tipo_vinculo || null,
          categoria_id: data.categoria_id || null,
          valor_contribuicao: selectedCategoria?.valor_contribuicao || 0,
          forma_pagamento: data.forma_pagamento || null,
          documento_foto_url: fotoUrl,
          documento_rg_url: rgUrl,
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!sindicato) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Sindicato não encontrado</CardTitle>
            <CardDescription>
              O link de acesso está incorreto ou o sindicato não está disponível.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="max-w-lg text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl text-emerald-700 dark:text-emerald-400">
              Solicitação Enviada!
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Sua filiação ao <strong>{sindicato.razao_social}</strong> foi registrada com sucesso.
              Nossa equipe irá analisar sua solicitação e entrar em contato em breve.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Você receberá um e-mail de confirmação com os próximos passos.
            </p>
            <Button onClick={() => window.location.reload()}>
              Nova Filiação
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          {sindicato.logo_url && (
            <img 
              src={sindicato.logo_url} 
              alt={sindicato.razao_social} 
              className="h-20 mx-auto mb-4 rounded-lg bg-white p-2"
            />
          )}
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            Filie-se ao {sindicato.razao_social}
          </h1>
          <p className="text-emerald-100 text-sm md:text-base">
            Preencha o formulário abaixo para solicitar sua filiação
          </p>
        </div>
      </div>

      {/* Formulário */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Dados Pessoais */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <UserPlus className="h-5 w-5" />
                  Dados Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Digite seu nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <CpfInputCard
                          value={field.value}
                          onChange={field.onChange}
                          error={form.formState.errors.cpf?.message}
                          required
                        />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RG</FormLabel>
                        <FormControl>
                          <Input placeholder="Número do RG" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="data_nascimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sexo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sexo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="masculino">Masculino</SelectItem>
                            <SelectItem value="feminino">Feminino</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                            <SelectItem value="nao_informar">Prefiro não informar</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="estado_civil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado Civil</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Contato */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <Building2 className="h-5 w-5" />
                  Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="telefone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone / WhatsApp *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="(00) 00000-0000" 
                            value={field.value}
                            onChange={(e) => field.onChange(formatPhone(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="seu@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Endereço */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                  <MapPin className="h-5 w-5" />
                  Endereço
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="cep"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              placeholder="00000-000" 
                              value={field.value}
                              onChange={(e) => handleCepChange(e.target.value)}
                            />
                            {cepLoading && (
                              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="logradouro"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Logradouro</FormLabel>
                        <FormControl>
                          <Input placeholder="Rua, Avenida..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="numero"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input placeholder="Nº" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="complemento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complemento</FormLabel>
                        <FormControl>
                          <Input placeholder="Apto, Bloco..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bairro"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input placeholder="Bairro" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <FormField
                      control={form.control}
                      name="cidade"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input placeholder="Cidade" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF</FormLabel>
                          <FormControl>
                            <Input placeholder="UF" maxLength={2} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dados Profissionais */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <Briefcase className="h-5 w-5" />
                  Dados Profissionais
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="empresa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Empresa onde trabalha</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome da empresa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cargo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cargo / Função</FormLabel>
                        <FormControl>
                          <Input placeholder="Seu cargo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tipo_vinculo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Vínculo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="clt">CLT</SelectItem>
                            <SelectItem value="autonomo">Autônomo</SelectItem>
                            <SelectItem value="pj">PJ</SelectItem>
                            <SelectItem value="temporario">Temporário</SelectItem>
                            <SelectItem value="estagiario">Estagiário</SelectItem>
                            <SelectItem value="aposentado">Aposentado</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Dados da Filiação */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300">
                  <CreditCard className="h-5 w-5" />
                  Dados da Filiação
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="categoria_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria de Sócio</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            const cat = categorias.find(c => c.id === value);
                            setSelectedCategoria(cat || null);
                          }} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma categoria" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categorias.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.nome} - R$ {cat.valor_contribuicao.toFixed(2)}/{cat.periodicidade}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="forma_pagamento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Forma de Pagamento</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="boleto">Boleto Bancário</SelectItem>
                            <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                            <SelectItem value="desconto_folha">Desconto em Folha</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {selectedCategoria && (
                  <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
                    <p className="text-sm text-cyan-700 dark:text-cyan-300">
                      <strong>Valor da contribuição:</strong> R$ {selectedCategoria.valor_contribuicao.toFixed(2)} ({selectedCategoria.periodicidade})
                    </p>
                    {selectedCategoria.descricao && (
                      <p className="text-sm text-cyan-600 dark:text-cyan-400 mt-1">
                        {selectedCategoria.descricao}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documentos */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-800/20 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                  <FileText className="h-5 w-5" />
                  Documentos (Opcional)
                </CardTitle>
                <CardDescription>
                  Anexe documentos para agilizar a análise da sua filiação
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Foto 3x4</Label>
                    <Input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "foto")}
                      disabled={uploadingFoto}
                    />
                    {uploadingFoto && <p className="text-xs text-muted-foreground">Enviando...</p>}
                    {fotoUrl && <p className="text-xs text-green-600">✓ Enviado</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>RG / CNH</Label>
                    <Input 
                      type="file" 
                      accept="image/*,application/pdf"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "rg")}
                      disabled={uploadingRg}
                    />
                    {uploadingRg && <p className="text-xs text-muted-foreground">Enviando...</p>}
                    {rgUrl && <p className="text-xs text-green-600">✓ Enviado</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Comprovante de Residência</Label>
                    <Input 
                      type="file" 
                      accept="image/*,application/pdf"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "comprovante")}
                      disabled={uploadingComprovante}
                    />
                    {uploadingComprovante && <p className="text-xs text-muted-foreground">Enviando...</p>}
                    {comprovanteUrl && <p className="text-xs text-green-600">✓ Enviado</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Aceite LGPD */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/20 dark:to-slate-800/20 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Shield className="h-5 w-5" />
                  Termos e Condições
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <FormField
                  control={form.control}
                  name="aceite_lgpd"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-normal">
                          Li e aceito os <a href="/lgpd" target="_blank" className="text-primary underline">Termos de Uso e Política de Privacidade</a>.
                          Autorizo o tratamento dos meus dados pessoais conforme a LGPD. *
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Botão de envio */}
            <div className="flex justify-center">
              <Button 
                type="submit" 
                size="lg" 
                className="w-full md:w-auto min-w-[200px] bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Solicitar Filiação
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* Footer */}
      <div className="bg-slate-100 dark:bg-slate-800 py-6 px-4 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} {sindicato.razao_social}. Todos os direitos reservados.</p>
      </div>
    </div>
  );
}
