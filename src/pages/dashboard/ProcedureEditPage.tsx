import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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

interface InsurancePlan {
  id: string;
  name: string;
  is_active: boolean;
}

interface InsurancePrice {
  insurance_plan_id: string;
  price: number;
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

export default function ProcedureEditPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentClinic } = useAuth();
  const queryClient = useQueryClient();
  const returnTo = searchParams.get("returnTo") || "/dashboard/procedures";

  const [insurancePrices, setInsurancePrices] = useState<Record<string, string>>({});

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

  // Fetch procedure data
  const { data: procedure, isLoading } = useQuery({
    queryKey: ["procedure", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("procedures")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch insurance plans
  const { data: insurancePlans = [] } = useQuery({
    queryKey: ["insurance-plans", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("insurance_plans")
        .select("id, name, is_active")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as InsurancePlan[];
    },
    enabled: !!currentClinic?.id,
  });

  // Fetch existing insurance prices for this procedure
  const { data: existingPrices = [] } = useQuery({
    queryKey: ["procedure-insurance-prices", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("procedure_insurance_prices")
        .select("insurance_plan_id, price")
        .eq("procedure_id", id);
      if (error) throw error;
      return data as InsurancePrice[];
    },
    enabled: !!id,
  });

  // Populate form when procedure loads
  useEffect(() => {
    if (procedure) {
      form.reset({
        name: procedure.name,
        description: procedure.description || "",
        price: procedure.price,
        duration_minutes: procedure.duration_minutes || 30,
        category: procedure.category || "",
        color: procedure.color || "#3b82f6",
        is_active: procedure.is_active ?? true,
      });
    }
  }, [procedure, form]);

  // Populate insurance prices when they load
  useEffect(() => {
    if (existingPrices.length > 0) {
      const pricesMap: Record<string, string> = {};
      existingPrices.forEach((p) => {
        pricesMap[p.insurance_plan_id] = p.price.toString();
      });
      setInsurancePrices(pricesMap);
    }
  }, [existingPrices]);

  const mutation = useMutation({
    mutationFn: async (data: ProcedureFormData) => {
      if (!id || !currentClinic?.id) throw new Error("Missing procedure or clinic ID");

      const payload = {
        name: data.name,
        description: data.description || null,
        price: data.price,
        duration_minutes: data.duration_minutes,
        category: data.category || null,
        color: data.color,
        is_active: data.is_active,
      };

      const { error } = await supabase
        .from("procedures")
        .update(payload)
        .eq("id", id);
      if (error) throw error;

      // Save insurance prices
      // Delete existing prices first
      await supabase
        .from("procedure_insurance_prices")
        .delete()
        .eq("procedure_id", id);

      // Insert new prices
      const pricesToInsert = Object.entries(insurancePrices)
        .filter(([_, price]) => price && parseFloat(price) > 0)
        .map(([insurancePlanId, price]) => ({
          procedure_id: id,
          insurance_plan_id: insurancePlanId,
          price: parseFloat(price),
        }));

      if (pricesToInsert.length > 0) {
        const { error: priceError } = await supabase
          .from("procedure_insurance_prices")
          .insert(pricesToInsert);
        if (priceError) throw priceError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      queryClient.invalidateQueries({ queryKey: ["procedure-insurance-prices"] });
      toast.success("Procedimento atualizado com sucesso");
      navigate(returnTo);
    },
    onError: (error) => {
      console.error("Error updating procedure:", error);
      toast.error("Erro ao atualizar procedimento");
    },
  });

  const onSubmit = (data: ProcedureFormData) => {
    mutation.mutate(data);
  };

  const handleInsurancePriceChange = (insuranceId: string, value: string) => {
    setInsurancePrices((prev) => ({
      ...prev,
      [insuranceId]: value,
    }));
  };

  const handleCancel = () => {
    navigate(returnTo);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!procedure) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(returnTo)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Procedimento não encontrado</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Editar Procedimento</h1>
          <p className="text-muted-foreground">{procedure.name}</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Procedimento</CardTitle>
              <CardDescription>Dados básicos do procedimento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço Padrão (R$) *</FormLabel>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                {colors.find((c) => c.value === field.value)?.label || "Selecione..."}
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
            </CardContent>
          </Card>

          {/* Insurance Prices Section */}
          {insurancePlans.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Preços por Convênio</CardTitle>
                    <CardDescription>
                      Defina preços específicos para cada convênio. Se não definido, será usado o preço padrão.
                    </CardDescription>
                  </div>
                  <Badge variant="outline">Opcional</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {insurancePlans.map((insurance) => (
                    <div key={insurance.id} className="flex items-center gap-4">
                      <span className="text-sm text-foreground min-w-[150px] truncate">
                        {insurance.name}
                      </span>
                      <div className="flex items-center gap-2 flex-1 max-w-xs">
                        <span className="text-sm text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Usar padrão"
                          value={insurancePrices[insurance.id] || ""}
                          onChange={(e) =>
                            handleInsurancePriceChange(insurance.id, e.target.value)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
