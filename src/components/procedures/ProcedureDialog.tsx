import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const procedureSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Preço deve ser maior ou igual a 0"),
  duration_minutes: z.coerce.number().min(5, "Duração mínima é 5 minutos"),
  category: z.string().optional(),
  color: z.string().default("#3b82f6"),
  is_active: z.boolean().default(true),
});

type ProcedureFormData = z.infer<typeof procedureSchema>;

interface ProcedureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  procedure?: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    duration_minutes: number;
    category: string | null;
    color: string;
    is_active: boolean;
  } | null;
}

const categories = [
  "Consulta",
  "Exame",
  "Procedimento",
  "Cirurgia",
  "Retorno",
  "Avaliação",
  "Outro",
];

const colors = [
  { value: "#3b82f6", label: "Azul" },
  { value: "#10b981", label: "Verde" },
  { value: "#f59e0b", label: "Amarelo" },
  { value: "#ef4444", label: "Vermelho" },
  { value: "#8b5cf6", label: "Roxo" },
  { value: "#ec4899", label: "Rosa" },
  { value: "#06b6d4", label: "Ciano" },
  { value: "#6b7280", label: "Cinza" },
];

export function ProcedureDialog({
  open,
  onOpenChange,
  clinicId,
  procedure,
}: ProcedureDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!procedure;

  const form = useForm<ProcedureFormData>({
    resolver: zodResolver(procedureSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      duration_minutes: 30,
      category: "",
      color: "#3b82f6",
      is_active: true,
    },
  });

  useEffect(() => {
    if (procedure) {
      form.reset({
        name: procedure.name,
        description: procedure.description || "",
        price: procedure.price,
        duration_minutes: procedure.duration_minutes,
        category: procedure.category || "",
        color: procedure.color,
        is_active: procedure.is_active,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        price: 0,
        duration_minutes: 30,
        category: "",
        color: "#3b82f6",
        is_active: true,
      });
    }
  }, [procedure, form]);

  const mutation = useMutation({
    mutationFn: async (data: ProcedureFormData) => {
      const payload = {
        clinic_id: clinicId,
        name: data.name,
        description: data.description || null,
        price: data.price,
        duration_minutes: data.duration_minutes,
        category: data.category || null,
        color: data.color,
        is_active: data.is_active,
      };

      if (isEditing && procedure) {
        const { error } = await supabase
          .from("procedures")
          .update(payload)
          .eq("id", procedure.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("procedures").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      toast.success(
        isEditing
          ? "Procedimento atualizado com sucesso"
          : "Procedimento criado com sucesso"
      );
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Error saving procedure:", error);
      toast.error("Erro ao salvar procedimento");
    },
  });

  const onSubmit = (data: ProcedureFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Procedimento" : "Novo Procedimento"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Consulta Particular" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrição do procedimento..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço (R$) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duração (min) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="5"
                        step="5"
                        placeholder="30"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
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
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cor</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: field.value }}
                              />
                              {colors.find((c) => c.value === field.value)?.label}
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {colors.map((color) => (
                          <SelectItem key={color.value} value={color.value}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: color.value }}
                              />
                              {color.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending
                  ? "Salvando..."
                  : isEditing
                  ? "Salvar"
                  : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
