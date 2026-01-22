import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Clock, Save, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface HomologacaoProfessionalScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professional: {
    id: string;
    name: string;
  } | null;
  clinicId: string;
}

interface ScheduleEntry {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity: number;
  is_active: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

const DEFAULT_SCHEDULE: ScheduleEntry = {
  start_time: "08:00",
  end_time: "18:00",
  capacity: 1,
  is_active: false,
  day_of_week: 0,
};

export function HomologacaoProfessionalScheduleDialog({
  open,
  onOpenChange,
  professional,
  clinicId,
}: HomologacaoProfessionalScheduleDialogProps) {
  const queryClient = useQueryClient();
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Buscar horários existentes
  const { data: existingSchedules, isLoading, refetch } = useQuery({
    queryKey: ["homologacao-schedules", professional?.id],
    queryFn: async () => {
      if (!professional?.id) return [];
      
      const { data, error } = await supabase
        .from("homologacao_schedules")
        .select("*")
        .eq("professional_id", professional.id)
        .order("day_of_week");

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!professional?.id,
    staleTime: 0, // Always fetch fresh data when dialog opens
    refetchOnMount: "always",
  });

  // Refetch when dialog opens
  useEffect(() => {
    if (open && professional?.id) {
      refetch();
    }
  }, [open, professional?.id, refetch]);

  // Inicializar schedules quando dados carregarem
  useEffect(() => {
    if (!open) return;

    const initialSchedules = DAYS_OF_WEEK.map((day) => {
      const existing = existingSchedules?.find(
        (s) => s.day_of_week === day.value
      );
      if (existing) {
        return {
          id: existing.id,
          day_of_week: existing.day_of_week,
          start_time: existing.start_time?.slice(0, 5) || "08:00",
          end_time: existing.end_time?.slice(0, 5) || "18:00",
          capacity: existing.capacity || 1,
          is_active: existing.is_active ?? false,
        };
      }
      return { ...DEFAULT_SCHEDULE, day_of_week: day.value };
    });

    setSchedules(initialSchedules);
    setHasChanges(false);
  }, [existingSchedules, open]);

  // Mutation para salvar horários
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!professional?.id || !clinicId) {
        throw new Error("Profissional ou clínica não selecionados");
      }

      // Validar horários
      for (const schedule of schedules) {
        if (schedule.is_active && schedule.start_time >= schedule.end_time) {
          throw new Error(
            `${DAYS_OF_WEEK[schedule.day_of_week].label}: Hora de término deve ser maior que hora de início`
          );
        }
      }

      // Upsert cada dia
      for (const schedule of schedules) {
        if (schedule.id) {
          // Atualizar existente
          const { error } = await supabase
            .from("homologacao_schedules")
            .update({
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              capacity: schedule.capacity,
              is_active: schedule.is_active,
            })
            .eq("id", schedule.id);

          if (error) throw error;
        } else if (schedule.is_active) {
          // Criar novo apenas se ativo
          const { error } = await supabase
            .from("homologacao_schedules")
            .insert({
              clinic_id: clinicId,
              professional_id: professional.id,
              day_of_week: schedule.day_of_week,
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              capacity: schedule.capacity,
              is_active: schedule.is_active,
            });

          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["homologacao-schedules", professional?.id],
      });
      toast.success("Horários salvos com sucesso!");
      setHasChanges(false);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error("Erro ao salvar horários:", error);
      toast.error(error.message || "Erro ao salvar horários");
    },
  });

  const updateSchedule = (
    dayOfWeek: number,
    field: keyof ScheduleEntry,
    value: string | number | boolean
  ) => {
    setSchedules((prev) =>
      prev.map((s) =>
        s.day_of_week === dayOfWeek ? { ...s, [field]: value } : s
      )
    );
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate();
  };

  if (!professional) return null;

  return (
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="2xl">
      <PopupHeader>
        <PopupTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Horários de Atendimento
        </PopupTitle>
        <PopupDescription>
          Configure os horários de atendimento de {professional.name}
        </PopupDescription>
      </PopupHeader>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {schedules.map((schedule) => {
                const day = DAYS_OF_WEEK.find(
                  (d) => d.value === schedule.day_of_week
                );
                const hasError =
                  schedule.is_active && schedule.start_time >= schedule.end_time;

                return (
                  <div
                    key={schedule.day_of_week}
                    className={cn(
                      "p-4 rounded-lg border transition-colors",
                      schedule.is_active
                        ? "bg-card border-border"
                        : "bg-muted/30 border-transparent",
                      hasError && "border-destructive"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={schedule.is_active}
                          onCheckedChange={(checked) =>
                            updateSchedule(schedule.day_of_week, "is_active", checked)
                          }
                        />
                        <Label
                          className={cn(
                            "font-medium",
                            !schedule.is_active && "text-muted-foreground"
                          )}
                        >
                          {day?.label}
                        </Label>
                      </div>
                      {hasError && (
                        <div className="flex items-center gap-1 text-destructive text-sm">
                          <AlertCircle className="w-4 h-4" />
                          Horário inválido
                        </div>
                      )}
                    </div>

                    {schedule.is_active && (
                      <div className="grid grid-cols-3 gap-4 mt-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">
                            Início
                          </Label>
                          <Input
                            type="time"
                            value={schedule.start_time}
                            onChange={(e) =>
                              updateSchedule(
                                schedule.day_of_week,
                                "start_time",
                                e.target.value
                              )
                            }
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">
                            Término
                          </Label>
                          <Input
                            type="time"
                            value={schedule.end_time}
                            onChange={(e) =>
                              updateSchedule(
                                schedule.day_of_week,
                                "end_time",
                                e.target.value
                              )
                            }
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">
                            Capacidade
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            max={99}
                            value={schedule.capacity}
                            onChange={(e) =>
                              updateSchedule(
                                schedule.day_of_week,
                                "capacity",
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="h-9"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <PopupFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Horários
              </>
            )}
          </Button>
        </PopupFooter>
    </PopupBase>
  );
}
