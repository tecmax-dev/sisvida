import { useState, useEffect } from "react";
import { Clock, Plus, Trash2, Calendar, CalendarOff } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PopupBase, PopupHeader, PopupTitle, PopupFooter } from "@/components/ui/popup-base";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ScheduleException {
  id?: string;
  exception_date: string;
  is_day_off: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string;
}

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professional: {
    id: string;
    name: string;
    schedule: Record<string, { enabled: boolean; slots: { start: string; end: string }[] }> | null;
  };
  appointmentDuration?: number;
  onUpdate: () => void;
}

const weekDays = [
  { key: "monday", label: "Segunda-feira" },
  { key: "tuesday", label: "Terça-feira" },
  { key: "wednesday", label: "Quarta-feira" },
  { key: "thursday", label: "Quinta-feira" },
  { key: "friday", label: "Sexta-feira" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

const generateTimeOptions = (intervalMinutes: number): string[] => {
  const options: string[] = [];
  for (let h = 6; h <= 22; h++) {
    for (let m = 0; m < 60; m += intervalMinutes) {
      if (h === 22 && m > 0) break;
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return options;
};

type Schedule = Record<string, { enabled: boolean; slots: { start: string; end: string }[] }>;

const defaultSchedule: Schedule = {
  monday: { enabled: true, slots: [{ start: "08:00", end: "12:00" }, { start: "14:00", end: "18:00" }] },
  tuesday: { enabled: true, slots: [{ start: "08:00", end: "12:00" }, { start: "14:00", end: "18:00" }] },
  wednesday: { enabled: true, slots: [{ start: "08:00", end: "12:00" }, { start: "14:00", end: "18:00" }] },
  thursday: { enabled: true, slots: [{ start: "08:00", end: "12:00" }, { start: "14:00", end: "18:00" }] },
  friday: { enabled: true, slots: [{ start: "08:00", end: "12:00" }, { start: "14:00", end: "18:00" }] },
  saturday: { enabled: false, slots: [] },
  sunday: { enabled: false, slots: [] },
};

export function ScheduleDialog({ open, onOpenChange, professional, appointmentDuration = 30, onUpdate }: ScheduleDialogProps) {
  const { toast } = useToast();
  const { currentClinic } = useAuth();
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<Schedule>(
    (professional.schedule as Schedule) || defaultSchedule
  );
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [loadingExceptions, setLoadingExceptions] = useState(false);
  
  const timeOptions = generateTimeOptions(appointmentDuration);

  useEffect(() => {
    if (open && professional.id) {
      fetchExceptions();
    }
  }, [open, professional.id]);

  const fetchExceptions = async () => {
    setLoadingExceptions(true);
    try {
      const { data, error } = await supabase
        .from('professional_schedule_exceptions')
        .select('*')
        .eq('professional_id', professional.id)
        .gte('exception_date', format(new Date(), 'yyyy-MM-dd'))
        .order('exception_date');

      if (error) throw error;
      setExceptions(data || []);
    } catch (error) {
      console.error('Error fetching exceptions:', error);
    } finally {
      setLoadingExceptions(false);
    }
  };

  const toggleDay = (day: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day]?.enabled,
        slots: !prev[day]?.enabled ? [{ start: "08:00", end: "18:00" }] : prev[day]?.slots || [],
      }
    }));
  };

  const addSlot = (day: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: [...(prev[day]?.slots || []), { start: "08:00", end: "12:00" }],
      }
    }));
  };

  const removeSlot = (day: string, index: number) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day]?.slots.filter((_, i) => i !== index) || [],
      }
    }));
  };

  const updateSlot = (day: string, index: number, field: "start" | "end", value: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day]?.slots.map((slot, i) => 
          i === index ? { ...slot, [field]: value } : slot
        ) || [],
      }
    }));
  };

  const addException = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setExceptions(prev => [...prev, {
      exception_date: format(tomorrow, 'yyyy-MM-dd'),
      is_day_off: false,
      start_time: "08:00",
      end_time: "12:00",
      reason: "",
    }]);
  };

  const updateException = (index: number, field: keyof ScheduleException, value: any) => {
    setExceptions(prev => prev.map((exc, i) => 
      i === index ? { ...exc, [field]: value } : exc
    ));
  };

  const removeException = async (index: number) => {
    const exception = exceptions[index];
    if (exception.id) {
      try {
        await supabase
          .from('professional_schedule_exceptions')
          .delete()
          .eq('id', exception.id);
      } catch (error) {
        console.error('Error deleting exception:', error);
      }
    }
    setExceptions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!currentClinic) return;
    
    setSaving(true);
    try {
      const { error: scheduleError } = await supabase
        .from('professionals')
        .update({ schedule })
        .eq('id', professional.id);

      if (scheduleError) throw scheduleError;

      for (const exception of exceptions) {
        const exceptionData = {
          professional_id: professional.id,
          clinic_id: currentClinic.id,
          exception_date: exception.exception_date,
          is_day_off: exception.is_day_off,
          start_time: exception.is_day_off ? null : exception.start_time,
          end_time: exception.is_day_off ? null : exception.end_time,
          reason: exception.reason || null,
        };

        if (exception.id) {
          await supabase
            .from('professional_schedule_exceptions')
            .update(exceptionData)
            .eq('id', exception.id);
        } else {
          await supabase
            .from('professional_schedule_exceptions')
            .upsert(exceptionData, { onConflict: 'professional_id,exception_date' });
        }
      }

      toast({
        title: "Horários salvos",
        description: "Os horários de atendimento foram atualizados.",
      });
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="2xl">
      <PopupHeader>
        <PopupTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Horários de Atendimento - {professional.name}
        </PopupTitle>
      </PopupHeader>

      <Tabs defaultValue="weekly" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="weekly" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Horário Semanal
          </TabsTrigger>
          <TabsTrigger value="exceptions" className="flex items-center gap-2">
            <CalendarOff className="h-4 w-4" />
            Exceções ({exceptions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-4 py-4">
          {weekDays.map(({ key, label }) => (
            <div key={key} className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={schedule[key]?.enabled || false}
                    onCheckedChange={() => toggleDay(key)}
                  />
                  <Label className="font-medium text-foreground">{label}</Label>
                </div>
                {schedule[key]?.enabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addSlot(key)}
                    className="text-primary"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar horário
                  </Button>
                )}
              </div>

              {schedule[key]?.enabled && (
                <div className="space-y-2 ml-11">
                  {(schedule[key]?.slots || []).map((slot, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Select
                        value={slot.start}
                        onValueChange={(value) => updateSlot(key, index, "start", value)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map(time => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground">até</span>
                      <Select
                        value={slot.end}
                        onValueChange={(value) => updateSlot(key, index, "end", value)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map(time => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(schedule[key]?.slots.length || 0) > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSlot(key, index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!schedule[key]?.enabled && (
                <p className="text-sm text-muted-foreground ml-11">Não atende</p>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="exceptions" className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Configure horários especiais ou folgas para datas específicas.
            </p>
            <Button variant="outline" size="sm" onClick={addException}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Exceção
            </Button>
          </div>

          {loadingExceptions ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : exceptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma exceção cadastrada</p>
              <p className="text-xs">Clique em "Nova Exceção" para adicionar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {exceptions.map((exception, index) => (
                <div key={index} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Input
                        type="date"
                        value={exception.exception_date}
                        onChange={(e) => updateException(index, 'exception_date', e.target.value)}
                        className="w-40"
                        min={format(new Date(), 'yyyy-MM-dd')}
                      />
                      <span className="text-sm text-muted-foreground">
                        {exception.exception_date && format(parseISO(exception.exception_date), "EEEE", { locale: ptBR })}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeException(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      checked={exception.is_day_off}
                      onCheckedChange={(checked) => updateException(index, 'is_day_off', checked)}
                    />
                    <Label className="text-sm">Folga (não atende)</Label>
                  </div>

                  {!exception.is_day_off && (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm w-20">Horário:</Label>
                      <Select
                        value={exception.start_time || "08:00"}
                        onValueChange={(value) => updateException(index, 'start_time', value)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map(time => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground">até</span>
                      <Select
                        value={exception.end_time || "12:00"}
                        onValueChange={(value) => updateException(index, 'end_time', value)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map(time => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Input
                      placeholder="Motivo (opcional)"
                      value={exception.reason}
                      onChange={(e) => updateException(index, 'reason', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PopupFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar Horários"}
        </Button>
      </PopupFooter>
    </PopupBase>
  );
}
