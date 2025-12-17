import { useState } from "react";
import { Clock, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professional: {
    id: string;
    name: string;
    schedule: Record<string, { enabled: boolean; slots: { start: string; end: string }[] }> | null;
  };
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

const timeOptions = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"
];

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

export function ScheduleDialog({ open, onOpenChange, professional, onUpdate }: ScheduleDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<Schedule>(
    (professional.schedule as Schedule) || defaultSchedule
  );

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

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('professionals')
        .update({ schedule })
        .eq('id', professional.id);

      if (error) throw error;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horários de Atendimento - {professional.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Horários"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
