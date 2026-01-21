import { useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  partner_name: z.string().optional(),
  partner_cnpj: z.string().optional(),
  partner_phone: z.string().optional(),
  partner_email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  partner_address: z.string().optional(),
  category: z.string().optional(),
  validity_days: z.coerce.number().min(1, "Mínimo 1 dia").max(365, "Máximo 365 dias"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Benefit {
  id: string;
  name: string;
  description: string | null;
  partner_name: string | null;
  partner_cnpj: string | null;
  partner_phone: string | null;
  partner_email: string | null;
  partner_address: string | null;
  category: string | null;
  validity_days: number;
  notes: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  benefit: Benefit | null;
}

const categories = [
  "Saúde",
  "Educação",
  "Lazer",
  "Alimentação",
  "Transporte",
  "Jurídico",
  "Financeiro",
  "Outros",
];

export function UnionBenefitDialog({ open, onOpenChange, benefit }: Props) {
  const { currentClinic, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // DEBUG: wrap onOpenChange to trace the source
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    console.trace("🔥 UnionBenefitDialog onOpenChange", nextOpen, "hasFocus:", document.hasFocus(), "hidden:", document.hidden);
    onOpenChange(nextOpen);
  }, [onOpenChange]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      partner_name: "",
      partner_cnpj: "",
      partner_phone: "",
      partner_email: "",
      partner_address: "",
      category: "",
      validity_days: 30,
      notes: "",
    },
  });

  useEffect(() => {
    if (benefit) {
      form.reset({
        name: benefit.name,
        description: benefit.description || "",
        partner_name: benefit.partner_name || "",
        partner_cnpj: benefit.partner_cnpj || "",
        partner_phone: benefit.partner_phone || "",
        partner_email: benefit.partner_email || "",
        partner_address: benefit.partner_address || "",
        category: benefit.category || "",
        validity_days: benefit.validity_days,
        notes: benefit.notes || "",
      });
    } else {
      form.reset({
        name: "",
        description: "",
        partner_name: "",
        partner_cnpj: "",
        partner_phone: "",
        partner_email: "",
        partner_address: "",
        category: "",
        validity_days: 30,
        notes: "",
      });
    }
  }, [benefit, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!currentClinic?.id || !user?.id) throw new Error("Contexto inválido");

      const payload = {
        clinic_id: currentClinic.id,
        name: data.name,
        description: data.description || null,
        partner_name: data.partner_name || null,
        partner_cnpj: data.partner_cnpj || null,
        partner_phone: data.partner_phone || null,
        partner_email: data.partner_email || null,
        partner_address: data.partner_address || null,
        category: data.category || null,
        validity_days: data.validity_days,
        notes: data.notes || null,
      };

      if (benefit) {
        const { error } = await supabase
          .from("union_benefits")
          .update(payload)
          .eq("id", benefit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("union_benefits")
          .insert({ ...payload, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-benefits"] });
      toast({ title: benefit ? "Benefício atualizado!" : "Benefício criado!" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {benefit ? "Editar Benefício" : "Novo Benefício"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nome do Benefício *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Consultas Médicas" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="validity_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validade (dias) *</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="365" {...field} />
                    </FormControl>
                    <FormDescription>Validade padrão das autorizações</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descrição detalhada do benefício..." 
                        rows={2}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-4">Dados do Convênio/Parceiro</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="partner_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Convênio</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Clínica Popular" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="partner_cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <Input placeholder="00.000.000/0001-00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="partner_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(00) 00000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="partner_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="contato@convenio.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="partner_address"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua, número, cidade - UF" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Informações adicionais..." 
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {benefit ? "Salvar" : "Criar Benefício"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
