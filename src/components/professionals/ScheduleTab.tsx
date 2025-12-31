import { useState, useEffect, useRef } from "react";
import { Clock, Plus, Trash2, Loader2, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface ScheduleBlock {
  id?: string;
  days: string[];
  start_time: string;
  end_time: string;
  duration: number;
  start_date: string | null;
  end_date: string | null;
}

interface ScheduleTabProps {
  professionalId: string;
  professionalName: string;
  initialSchedule: Record<string, { enabled: boolean; slots: { start: string; end: string }[] }> | null;
  appointmentDuration?: number;
  onScheduleChange?: (schedule: any) => void;
}

const weekDays = [
  { key: "monday", label: "Segunda", short: "Seg" },
  { key: "tuesday", label: "Terça", short: "Ter" },
  { key: "wednesday", label: "Quarta", short: "Qua" },
  { key: "thursday", label: "Quinta", short: "Qui" },
  { key: "friday", label: "Sexta", short: "Sex" },
  { key: "saturday", label: "Sábado", short: "Sáb" },
  { key: "sunday", label: "Domingo", short: "Dom" },
];

const generateTimeOptions = (): string[] => {
  const options: string[] = [];
  for (let h = 0; h <= 23; h++) {
    for (let m = 0; m < 60; m += 5) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return options;
};

const durationOptions = [
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hora" },
  { value: 90, label: "1h30" },
  { value: 120, label: "2 horas" },
];

// Extended schedule type that includes blocks
interface ExtendedSchedule extends Record<string, any> {
  _blocks?: ScheduleBlock[];
}

// Convert old schedule format to new blocks format
const convertOldScheduleToBlocks = (
  oldSchedule: ExtendedSchedule | null,
  defaultDuration: number
): ScheduleBlock[] => {
  if (!oldSchedule) return [];
  
  // Check if we have the new blocks format saved
  if (oldSchedule._blocks && Array.isArray(oldSchedule._blocks) && oldSchedule._blocks.length > 0) {
    return oldSchedule._blocks.map(block => ({
      ...block,
      duration: block.duration || defaultDuration,
    }));
  }
  
  const blocks: ScheduleBlock[] = [];
  
  // Group similar slots across days
  const slotMap: Map<string, string[]> = new Map();
  
  Object.entries(oldSchedule).forEach(([day, config]) => {
    if (day === '_blocks') return; // Skip the blocks key
    if (config && typeof config === 'object' && 'enabled' in config && config.enabled && config.slots) {
      config.slots.forEach((slot: { start: string; end: string }) => {
        const key = `${slot.start}-${slot.end}`;
        if (!slotMap.has(key)) {
          slotMap.set(key, []);
        }
        slotMap.get(key)!.push(day);
      });
    }
  });
  
  slotMap.forEach((days, slotKey) => {
    const [start, end] = slotKey.split('-');
    blocks.push({
      days,
      start_time: start,
      end_time: end,
      duration: defaultDuration,
      start_date: null,
      end_date: null,
    });
  });
  
  return blocks.length > 0 ? blocks : [{
    days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    start_time: "08:00",
    end_time: "18:00",
    duration: defaultDuration,
    start_date: null,
    end_date: null,
  }];
};

// Convert blocks back to old schedule format for saving (includes _blocks for persistence)
const convertBlocksToOldSchedule = (blocks: ScheduleBlock[]): ExtendedSchedule => {
  const schedule: ExtendedSchedule = {
    monday: { enabled: false, slots: [] },
    tuesday: { enabled: false, slots: [] },
    wednesday: { enabled: false, slots: [] },
    thursday: { enabled: false, slots: [] },
    friday: { enabled: false, slots: [] },
    saturday: { enabled: false, slots: [] },
    sunday: { enabled: false, slots: [] },
    _blocks: blocks, // Save the full blocks array with dates
  };
  
  blocks.forEach(block => {
    block.days.forEach(day => {
      if (schedule[day] && typeof schedule[day] === 'object') {
        schedule[day].enabled = true;
        schedule[day].slots.push({
          start: block.start_time,
          end: block.end_time,
        });
      }
    });
  });
  
  return schedule;
};

export function ScheduleTab({ 
  professionalId, 
  professionalName, 
  initialSchedule, 
  appointmentDuration = 30,
  onScheduleChange 
}: ScheduleTabProps) {
  const { toast } = useToast();
  const { currentClinic } = useAuth();
  const [saving, setSaving] = useState(false);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>(() => 
    convertOldScheduleToBlocks(initialSchedule, appointmentDuration)
  );
  
  const timeOptions = generateTimeOptions();

  // Only update blocks when initialSchedule actually changes (by comparing JSON)
  const initialScheduleRef = useRef<string | null>(null);
  
  useEffect(() => {
    const newScheduleJson = initialSchedule ? JSON.stringify(initialSchedule) : null;
    if (initialScheduleRef.current !== newScheduleJson) {
      initialScheduleRef.current = newScheduleJson;
      if (initialSchedule) {
        setBlocks(convertOldScheduleToBlocks(initialSchedule, appointmentDuration));
      }
    }
  }, [initialSchedule, appointmentDuration]);

  const addBlock = () => {
    setBlocks(prev => [...prev, {
      days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      start_time: "08:00",
      end_time: "12:00",
      duration: appointmentDuration,
      start_date: null,
      end_date: null,
    }]);
  };

  const removeBlock = (index: number) => {
    setBlocks(prev => prev.filter((_, i) => i !== index));
  };

  const updateBlock = (index: number, field: keyof ScheduleBlock, value: any) => {
    setBlocks(prev => prev.map((block, i) => 
      i === index ? { ...block, [field]: value } : block
    ));
  };

  const toggleDay = (index: number, day: string) => {
    setBlocks(prev => prev.map((block, i) => {
      if (i !== index) return block;
      const days = block.days.includes(day)
        ? block.days.filter(d => d !== day)
        : [...block.days, day];
      return { ...block, days };
    }));
  };

  const handleSave = async () => {
    if (!currentClinic) return;
    
    setSaving(true);
    try {
      // Convert blocks to old schedule format
      const schedule = convertBlocksToOldSchedule(blocks);
      
      const { error: scheduleError } = await supabase
        .from('professionals')
        .update({ schedule })
        .eq('id', professionalId);

      if (scheduleError) throw scheduleError;

      // Save schedule blocks with date ranges as exceptions
      for (const block of blocks) {
        if (block.start_date || block.end_date) {
          // Save as schedule exceptions for date-specific schedules
          const startDate = block.start_date ? new Date(block.start_date) : new Date();
          const endDate = block.end_date ? new Date(block.end_date) : null;
          
          // For now, just save the main schedule
          // Date-specific schedules could be expanded later
        }
      }

      toast({
        title: "Horários salvos",
        description: "Os horários de atendimento foram atualizados.",
      });
      
      onScheduleChange?.(schedule);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Horários de Atendimento</h3>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addBlock}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Horário
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {blocks.map((block, index) => (
          <div key={index} className="border border-border rounded-lg p-4 space-y-4 bg-card">
            <div className="flex items-start justify-between">
              <span className="text-sm font-medium text-muted-foreground">Bloco {index + 1}</span>
              {blocks.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeBlock(index)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Days Selection */}
              <div className="lg:col-span-2">
                <Label className="text-xs text-muted-foreground mb-2 block">Dias</Label>
                <div className="flex flex-wrap gap-1.5 p-2 border border-input rounded-md bg-background min-h-[42px]">
                  {weekDays.map(day => (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => toggleDay(index, day.key)}
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium transition-colors",
                        block.days.includes(day.key)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Time */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Hora Início</Label>
                <Select
                  value={block.start_time}
                  onValueChange={(value) => updateBlock(index, 'start_time', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(time => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* End Time */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Hora Fim</Label>
                <Select
                  value={block.end_time}
                  onValueChange={(value) => updateBlock(index, 'end_time', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(time => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Duration */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Duração</Label>
                <Select
                  value={String(block.duration)}
                  onValueChange={(value) => updateBlock(index, 'duration', Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {durationOptions.map(opt => (
                      <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !block.start_date && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {block.start_date 
                        ? format(parseISO(block.start_date), "dd/MM/yyyy", { locale: ptBR })
                        : "Sem limite"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={block.start_date ? parseISO(block.start_date) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          updateBlock(index, 'start_date', `${year}-${month}-${day}`);
                        } else {
                          updateBlock(index, 'start_date', null);
                        }
                      }}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                    {block.start_date && (
                      <div className="p-2 border-t">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full"
                          onClick={() => updateBlock(index, 'start_date', null)}
                        >
                          Limpar
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !block.end_date && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {block.end_date 
                        ? format(parseISO(block.end_date), "dd/MM/yyyy", { locale: ptBR })
                        : "Sem limite"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={block.end_date ? parseISO(block.end_date) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          updateBlock(index, 'end_date', `${year}-${month}-${day}`);
                        } else {
                          updateBlock(index, 'end_date', null);
                        }
                      }}
                      locale={ptBR}
                      disabled={(date) => block.start_date ? date < parseISO(block.start_date) : false}
                      className="pointer-events-auto"
                    />
                    {block.end_date && (
                      <div className="p-2 border-t">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full"
                          onClick={() => updateBlock(index, 'end_date', null)}
                        >
                          Limpar
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Summary */}
            <div className="pt-2 border-t border-border">
              <div className="flex flex-wrap gap-1">
                {block.days.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">Nenhum dia selecionado</span>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {block.days.map(d => weekDays.find(w => w.key === d)?.label).join(', ')}
                    </span>
                    <span className="text-xs text-muted-foreground mx-1">•</span>
                    <span className="text-xs text-muted-foreground">
                      {block.start_time} às {block.end_time}
                    </span>
                    {(block.start_date || block.end_date) && (
                      <>
                        <span className="text-xs text-muted-foreground mx-1">•</span>
                        <span className="text-xs text-primary">
                          {block.start_date && !block.end_date && `A partir de ${format(parseISO(block.start_date), "dd/MM/yyyy")}`}
                          {!block.start_date && block.end_date && `Até ${format(parseISO(block.end_date), "dd/MM/yyyy")}`}
                          {block.start_date && block.end_date && `${format(parseISO(block.start_date), "dd/MM")} a ${format(parseISO(block.end_date), "dd/MM/yyyy")}`}
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {blocks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum horário configurado</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={addBlock}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar horário
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
