import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Calendar, Clock, User, Stethoscope } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  is_dynamic: z.boolean(),
  is_active: z.boolean(),
  // Filter criteria
  lastVisitDays: z.string().optional(),
  birthdayMonth: z.string().optional(),
  gender: z.string().optional(),
  ageMin: z.string().optional(),
  ageMax: z.string().optional(),
  procedureId: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Segment {
  id: string;
  name: string;
  description: string | null;
  filter_criteria: Record<string, any>;
  is_dynamic: boolean;
  is_active: boolean;
}

interface SegmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment: Segment | null;
  clinicId: string;
}

const months = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

export default function SegmentDialog({
  open,
  onOpenChange,
  segment,
  clinicId,
}: SegmentDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!segment;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      is_dynamic: true,
      is_active: true,
      lastVisitDays: "",
      birthdayMonth: "",
      gender: "",
      ageMin: "",
      ageMax: "",
      procedureId: "",
    },
  });

  const { data: procedures } = useQuery({
    queryKey: ["procedures", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procedures")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (segment) {
      const criteria = segment.filter_criteria || {};
      form.reset({
        name: segment.name,
        description: segment.description || "",
        is_dynamic: segment.is_dynamic,
        is_active: segment.is_active,
        lastVisitDays: criteria.lastVisitDays?.toString() || "",
        birthdayMonth: criteria.birthdayMonth?.toString() || "",
        gender: criteria.gender || "",
        ageMin: criteria.ageMin?.toString() || "",
        ageMax: criteria.ageMax?.toString() || "",
        procedureId: criteria.procedureId || "",
      });
    } else {
      form.reset({
        name: "",
        description: "",
        is_dynamic: true,
        is_active: true,
        lastVisitDays: "",
        birthdayMonth: "",
        gender: "",
        ageMin: "",
        ageMax: "",
        procedureId: "",
      });
    }
  }, [segment, form, open]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const filterCriteria: Record<string, any> = {};
      if (data.lastVisitDays) filterCriteria.lastVisitDays = parseInt(data.lastVisitDays);
      if (data.birthdayMonth) filterCriteria.birthdayMonth = parseInt(data.birthdayMonth);
      if (data.gender) filterCriteria.gender = data.gender;
      if (data.ageMin) filterCriteria.ageMin = parseInt(data.ageMin);
      if (data.ageMax) filterCriteria.ageMax = parseInt(data.ageMax);
      if (data.procedureId) filterCriteria.procedureId = data.procedureId;

      const payload = {
        clinic_id: clinicId,
        name: data.name,
        description: data.description || null,
        is_dynamic: data.is_dynamic,
        is_active: data.is_active,
        filter_criteria: filterCriteria,
        patient_count: 0,
      };

      const { error } = await (supabase as any).from("patient_segments").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-segments"] });
      toast.success("Segmento criado com sucesso");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erro ao criar segmento");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const filterCriteria: Record<string, any> = {};
      if (data.lastVisitDays) filterCriteria.lastVisitDays = parseInt(data.lastVisitDays);
      if (data.birthdayMonth) filterCriteria.birthdayMonth = parseInt(data.birthdayMonth);
      if (data.gender) filterCriteria.gender = data.gender;
      if (data.ageMin) filterCriteria.ageMin = parseInt(data.ageMin);
      if (data.ageMax) filterCriteria.ageMax = parseInt(data.ageMax);
      if (data.procedureId) filterCriteria.procedureId = data.procedureId;

      const payload = {
        name: data.name,
        description: data.description || null,
        is_dynamic: data.is_dynamic,
        is_active: data.is_active,
        filter_criteria: filterCriteria,
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase as any)
        .from("patient_segments")
        .update(payload)
        .eq("id", segment!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-segments"] });
      toast.success("Segmento atualizado com sucesso");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erro ao atualizar segmento");
    },
  });

  const onSubmit = (data: FormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Segmento" : "Novo Segmento"}
          </DialogTitle>
          <DialogDescription>
            Defina os critérios para agrupar pacientes
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Segmento</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Pacientes inativos" {...field} />
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
                        placeholder="Descreva o objetivo deste segmento..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-6">
                <FormField
                  control={form.control}
                  name="is_dynamic"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div>
                        <FormLabel className="mb-0">Segmento Dinâmico</FormLabel>
                        <FormDescription className="text-xs">
                          Atualiza automaticamente conforme os critérios
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div>
                        <FormLabel className="mb-0">Ativo</FormLabel>
                        <FormDescription className="text-xs">
                          Pode ser usado em campanhas
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-medium">Critérios de Filtragem</h3>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Última Visita</span>
                    </div>
                    <FormField
                      control={form.control}
                      name="lastVisitDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Sem visita há (dias)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="Ex: 180"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Aniversário</span>
                    </div>
                    <FormField
                      control={form.control}
                      name="birthdayMonth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Mês de nascimento</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {months.map((month) => (
                                <SelectItem key={month.value} value={month.value}>
                                  {month.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Perfil</span>
                    </div>
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Gênero</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Qualquer" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="M">Masculino</SelectItem>
                              <SelectItem value="F">Feminino</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <FormField
                        control={form.control}
                        name="ageMin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Idade mín.</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="0" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="ageMax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Idade máx.</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="100" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Stethoscope className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Procedimento</span>
                    </div>
                    <FormField
                      control={form.control}
                      name="procedureId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Realizou procedimento</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Qualquer" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {procedures?.map((proc) => (
                                <SelectItem key={proc.id} value={proc.id}>
                                  {proc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Salvando..."
                  : isEditing
                  ? "Atualizar"
                  : "Criar Segmento"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
