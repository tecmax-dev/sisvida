import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  MapPin, 
  Briefcase, 
  Users, 
  CreditCard,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { DependentsList, Dependent } from "@/components/filiacao/DependentsList";
import { CnpjEmployerSearch } from "@/components/filiacao/CnpjEmployerSearch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Category {
  id: string;
  nome: string;
  valor_contribuicao: number;
}

interface EmployerData {
  employer_id?: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  endereco?: string;
}

const schema = z.object({
  // Dados pessoais
  name: z.string().min(3, "Nome é obrigatório"),
  cpf: z.string().min(11, "CPF é obrigatório"),
  rg: z.string().optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")),
  phone: z.string().min(10, "Telefone é obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  
  // Endereço
  cep: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  address_number: z.string().optional().or(z.literal("")),
  complement: z.string().optional().or(z.literal("")),
  neighborhood: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  
  // Dados profissionais
  job_function: z.string().optional().or(z.literal("")),
  admission_date: z.string().optional().or(z.literal("")),
  
  // União sindical
  status: z.enum(["ativo", "pendente", "inativo"]).default("ativo"),
  category_id: z.string().optional().or(z.literal("")),
  contribution_value: z.string().optional().or(z.literal("")),
  payment_method: z.string().optional().or(z.literal("")),
  observations: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCEP(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 8);
  return numbers.replace(/(\d{5})(\d)/, "$1-$2");
}

function formatCPF(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  return numbers
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2");
}

function formatPhone(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  if (numbers.length <= 10) {
    return numbers
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return numbers
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

interface SectionHeaderProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  isOpen?: boolean;
  onToggle?: () => void;
  collapsible?: boolean;
}

function SectionHeader({ icon: Icon, title, isOpen, onToggle, collapsible }: SectionHeaderProps) {
  if (collapsible) {
    return (
      <CollapsibleTrigger 
        onClick={onToggle}
        className="flex items-center gap-2 w-full py-2 text-left hover:bg-muted/50 rounded-md px-2 -mx-2"
      >
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">{title}</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 ml-auto text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
        )}
      </CollapsibleTrigger>
    );
  }
  
  return (
    <div className="flex items-center gap-2 py-2">
      <Icon className="h-4 w-4 text-primary" />
      <span className="font-medium text-sm">{title}</span>
    </div>
  );
}

export function UnionCreateMemberDialog({
  open,
  onOpenChange,
  clinicId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  onCreated?: (patientId: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [employerData, setEmployerData] = useState<EmployerData | null>(null);
  const [allowedRelationshipTypes, setAllowedRelationshipTypes] = useState<string[] | null>(null);
  
  // Collapsible sections state
  const [addressOpen, setAddressOpen] = useState(false);
  const [professionalOpen, setProfessionalOpen] = useState(false);
  const [dependentsOpen, setDependentsOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      cpf: "",
      rg: "",
      birth_date: "",
      phone: "",
      email: "",
      cep: "",
      address: "",
      address_number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      job_function: "",
      admission_date: "",
      status: "ativo",
      category_id: "",
      contribution_value: "",
      payment_method: "pix",
      observations: "",
    },
  });

  const selectedCategory = useMemo(() => {
    const categoryId = form.watch("category_id");
    return categories.find((c) => c.id === categoryId);
  }, [categories, form]);

  // Fetch categories and entity config
  useEffect(() => {
    if (!open) return;
    if (!clinicId) return;

    const fetchCategories = async () => {
      const { data, error } = await (supabase as any)
        .from("sindical_categorias")
        .select("id, nome, valor_contribuicao")
        .eq("sindicato_id", clinicId)
        .eq("ativo", true)
        .order("nome");

      if (error) {
        console.error(error);
        return;
      }
      setCategories((data as Category[]) || []);
    };

    const fetchEntityConfig = async () => {
      // Try to get union entity config for this clinic
      const { data: entity } = await (supabase as any)
        .from("union_entities")
        .select("allowed_relationship_types")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .maybeSingle();

      if (entity?.allowed_relationship_types) {
        if (Array.isArray(entity.allowed_relationship_types)) {
          setAllowedRelationshipTypes(entity.allowed_relationship_types);
        }
      }
    };

    fetchCategories();
    fetchEntityConfig();
  }, [open, clinicId]);

  // Auto-fill contribution value when category is selected
  useEffect(() => {
    if (!selectedCategory) return;
    const current = form.getValues("contribution_value");
    if (current) return;
    form.setValue("contribution_value", String(selectedCategory.valor_contribuicao ?? ""));
  }, [selectedCategory, form]);

  // CEP lookup
  const handleCepChange = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    form.setValue("cep", formatCEP(cep));

    if (cleanCep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
          form.setValue("address", data.logradouro || "");
          form.setValue("neighborhood", data.bairro || "");
          form.setValue("city", data.localidade || "");
          form.setValue("state", data.uf || "");
          setAddressOpen(true);
        }
      } catch (err) {
        console.error("Error fetching CEP:", err);
      }
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!clinicId) return;

    const cpfDigits = onlyDigits(values.cpf);
    if (cpfDigits.length !== 11) {
      toast.error("CPF inválido");
      return;
    }

    const phoneDigits = onlyDigits(values.phone);
    if (phoneDigits.length < 10) {
      toast.error("Telefone inválido");
      return;
    }

    const contributionValue = values.contribution_value
      ? Number(String(values.contribution_value).replace(",", "."))
      : null;

    if (values.contribution_value && Number.isNaN(contributionValue)) {
      toast.error("Valor de contribuição inválido");
      return;
    }

    setSaving(true);
    try {
      // Check if patient exists with this CPF
      const { data: existingPatient, error: existingError } = await supabase
        .from("patients")
        .select("id")
        .eq("clinic_id", clinicId)
        .or(`cpf.eq.${cpfDigits},cpf.eq.${values.cpf}`)
        .maybeSingle();

      if (existingError) throw existingError;

      let patientId = existingPatient?.id;

      const unionPatch = {
        is_union_member: true,
        union_member_status: values.status,
        union_category_id: values.category_id || null,
        union_contribution_value: contributionValue,
        union_payment_method: values.payment_method || null,
        union_joined_at: new Date().toISOString(),
        union_observations: values.observations || null,
        tag:
          values.status === "ativo"
            ? "Ativo"
            : values.status === "pendente"
            ? "Pendente"
            : "Inativo",
      };

      const patientData = {
        clinic_id: clinicId,
        name: values.name,
        cpf: cpfDigits,
        rg: values.rg || null,
        birth_date: values.birth_date || null,
        phone: phoneDigits,
        email: values.email || null,
        zip_code: onlyDigits(values.cep || ""),
        address: values.address || null,
        address_number: values.address_number || null,
        address_complement: values.complement || null,
        neighborhood: values.neighborhood || null,
        city: values.city || null,
        state: values.state || null,
        job_title: values.job_function || null,
        employer_id: employerData?.employer_id || null,
        ...unionPatch,
      };

      if (!patientId) {
        const { data: created, error: createError } = await supabase
          .from("patients")
          .insert(patientData)
          .select("id")
          .single();

        if (createError) throw createError;
        patientId = created.id;
      } else {
        // Update existing patient
        const { error: updateError } = await supabase
          .from("patients")
          .update({
            ...patientData,
            clinic_id: undefined, // Don't update clinic_id
          })
          .eq("id", patientId);

        if (updateError) throw updateError;
      }

      // Create dependents if any
      if (dependents.length > 0 && patientId) {
        for (const dep of dependents) {
          await supabase.from("patient_dependents").insert({
            clinic_id: clinicId,
            patient_id: patientId,
            name: dep.nome,
            relationship: dep.grau_parentesco,
            birth_date: dep.data_nascimento,
            cpf: dep.cpf?.replace(/\D/g, "") || null,
          });
        }
      }

      // Audit log
      await supabase.from("union_member_audit_logs").insert({
        clinic_id: clinicId,
        patient_id: patientId,
        action: "manual_create_member",
        changes: {
          source: "union_panel",
          status: values.status,
          category_id: values.category_id || null,
          contribution_value: contributionValue,
          employer: employerData?.razao_social || null,
          dependents_count: dependents.length,
        },
      });

      toast.success("Sócio criado/vinculado com sucesso");
      onOpenChange(false);
      form.reset();
      setDependents([]);
      setEmployerData(null);
      setAddressOpen(false);
      setProfessionalOpen(false);
      setDependentsOpen(false);
      onCreated?.(patientId);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao criar sócio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Novo Sócio</DialogTitle>
          <DialogDescription>
            Crie um sócio diretamente no painel sindical (sem depender do formulário público de filiação).
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-4">
              {/* Dados Pessoais */}
              <div className="space-y-3">
                <SectionHeader icon={User} title="Dados Pessoais" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nome completo" className="h-9" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="000.000.000-00"
                            className="h-9"
                            onChange={(e) => field.onChange(formatCPF(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
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
                          <Input {...field} placeholder="Número do RG" className="h-9" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="birth_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" className="h-9" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone/WhatsApp *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="(DD) 9XXXX-XXXX"
                            className="h-9"
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
                      <FormItem className="md:col-span-2">
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="email@exemplo.com" className="h-9" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Endereço - Collapsible */}
              <Collapsible open={addressOpen} onOpenChange={setAddressOpen}>
                <SectionHeader 
                  icon={MapPin} 
                  title="Endereço" 
                  isOpen={addressOpen}
                  onToggle={() => setAddressOpen(!addressOpen)}
                  collapsible
                />
                
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FormField
                      control={form.control}
                      name="cep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="00000-000"
                              className="h-9"
                              onChange={(e) => handleCepChange(e.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Logradouro</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Rua, Avenida..." className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nº" className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="complement"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complemento</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Apto, Bloco..." className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="neighborhood"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Bairro" className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Cidade" className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="UF" maxLength={2} className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Dados Profissionais - Collapsible */}
              <Collapsible open={professionalOpen} onOpenChange={setProfessionalOpen}>
                <SectionHeader 
                  icon={Briefcase} 
                  title="Dados Profissionais" 
                  isOpen={professionalOpen}
                  onToggle={() => setProfessionalOpen(!professionalOpen)}
                  collapsible
                />
                
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="job_function"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Função/Cargo</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Selecione a função" />
                              </SelectTrigger>
                            </FormControl>
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="admission_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Admissão</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-1">
                    <FormLabel>Empresa onde Trabalha</FormLabel>
                    <CnpjEmployerSearch
                      clinicId={clinicId}
                      onSelect={setEmployerData}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Dependentes - Collapsible */}
              <Collapsible open={dependentsOpen} onOpenChange={setDependentsOpen}>
                <SectionHeader 
                  icon={Users} 
                  title={`Dependentes ${dependents.length > 0 ? `(${dependents.length})` : "(Opcional)"}`}
                  isOpen={dependentsOpen}
                  onToggle={() => setDependentsOpen(!dependentsOpen)}
                  collapsible
                />
                
                <CollapsibleContent className="pt-2">
                  <DependentsList
                    dependents={dependents}
                    onChange={setDependents}
                    allowedRelationshipTypes={allowedRelationshipTypes}
                  />
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Dados de Filiação Sindical */}
              <div className="space-y-3">
                <SectionHeader icon={CreditCard} title="Dados de Filiação" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="inativo">Inativo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="payment_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Forma de Pagamento</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="desconto_folha">Desconto em Folha</SelectItem>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="boleto">Boleto Bancário</SelectItem>
                            <SelectItem value="debito_automatico">Débito Automático</SelectItem>
                            <SelectItem value="cash">Dinheiro</SelectItem>
                            <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                            <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                            <SelectItem value="bank_transfer">Transferência</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder={categories.length ? "Selecione" : "Sem categorias"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nome}
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
                    name="contribution_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor da Contribuição</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: 50,00" className="h-9" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="observations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} placeholder="Opcional" className="resize-none" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
            {saving ? "Salvando..." : "Criar sócio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
