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

interface Category {
  id: string;
  nome: string;
  valor_contribuicao: number;
}

const schema = z.object({
  name: z.string().min(3, "Nome é obrigatório"),
  cpf: z.string().min(11, "CPF é obrigatório"),
  phone: z.string().min(10, "Telefone é obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
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

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      cpf: "",
      phone: "",
      email: "",
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

  useEffect(() => {
    if (!open) return;
    if (!clinicId) return;

    const fetchCategories = async () => {
      const { data, error } = await (supabase as any)
        // Tipagem do client não inclui esta tabela (módulo sindical)
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

    fetchCategories();
  }, [open, clinicId]);

  // Auto-preencher valor da contribuição ao selecionar categoria
  useEffect(() => {
    if (!selectedCategory) return;
    const current = form.getValues("contribution_value");
    if (current) return;
    form.setValue("contribution_value", String(selectedCategory.valor_contribuicao ?? ""));
  }, [selectedCategory, form]);

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
      // Se já existir paciente com esse CPF na clínica, só vinculamos como sócio sindical
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
        // Mantém compatibilidade com telas que usam tag para status
        tag:
          values.status === "ativo"
            ? "Ativo"
            : values.status === "pendente"
            ? "Pendente"
            : "Inativo",
      };

      if (!patientId) {
        const { data: created, error: createError } = await supabase
          .from("patients")
          .insert({
            clinic_id: clinicId,
            name: values.name,
            cpf: cpfDigits,
            phone: values.phone,
            email: values.email || null,
            ...unionPatch,
          })
          .select("id")
          .single();

        if (createError) throw createError;
        patientId = created.id;
      } else {
        const { error: updateError } = await supabase
          .from("patients")
          .update(unionPatch)
          .eq("id", patientId);

        if (updateError) throw updateError;
      }

      await supabase.from("union_member_audit_logs").insert({
        clinic_id: clinicId,
        patient_id: patientId,
        action: "manual_create_member",
        changes: {
          source: "union_panel",
          status: values.status,
          category_id: values.category_id || null,
          contribution_value: contributionValue,
        },
      });

      toast.success("Sócio criado/vinculado com sucesso");
      onOpenChange(false);
      form.reset();
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Sócio</DialogTitle>
          <DialogDescription>
            Crie um sócio diretamente no painel sindical (sem depender do formulário público de filiação).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome completo" />
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
                      <Input {...field} placeholder="Somente números" />
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
                    <FormLabel>Telefone *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="(DD) 9XXXX-XXXX" />
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
                      <Input {...field} placeholder="email@exemplo.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
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
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="cash">Dinheiro</SelectItem>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="debit_card">Débito</SelectItem>
                        <SelectItem value="credit_card">Crédito</SelectItem>
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
                        <SelectTrigger>
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
                      <Input {...field} placeholder="Ex: 50,00" />
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
                    <Textarea {...field} rows={3} placeholder="Opcional" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Criar sócio"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
