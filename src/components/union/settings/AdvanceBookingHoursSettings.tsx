import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Clock, Save, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AdvanceBookingHoursSettingsProps {
  clinicId: string;
  currentValue?: number;
  onUpdate?: () => void;
  isAdmin?: boolean;
}

const OPTIONS = [
  { value: "0", label: "Sem restrição" },
  { value: "1", label: "1 hora" },
  { value: "2", label: "2 horas" },
  { value: "3", label: "3 horas" },
  { value: "4", label: "4 horas" },
  { value: "6", label: "6 horas (padrão)" },
  { value: "8", label: "8 horas" },
  { value: "12", label: "12 horas" },
  { value: "24", label: "24 horas (1 dia)" },
  { value: "48", label: "48 horas (2 dias)" },
];

export function AdvanceBookingHoursSettings({ clinicId, currentValue = 6, onUpdate, isAdmin = false }: AdvanceBookingHoursSettingsProps) {
  const [advanceHours, setAdvanceHours] = useState(currentValue.toString());
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Ocultar completamente para não-admins
  if (!isAdmin) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("clinics")
        .update({ min_advance_booking_hours: parseInt(advanceHours) })
        .eq("id", clinicId);

      if (error) throw error;

      toast({
        title: "Configuração salva",
        description: "O limite de antecedência para agendamento foi atualizado.",
      });

      onUpdate?.();
    } catch (err: any) {
      console.error("Erro ao salvar configuração:", err);
      toast({
        title: "Erro ao salvar",
        description: err.message || "Não foi possível salvar a configuração.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getLabel = (value: string) => {
    return OPTIONS.find(o => o.value === value)?.label || `${value} horas`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Antecedência Mínima para Agendamento
        </CardTitle>
        <CardDescription>
          Define o tempo mínimo de antecedência necessário para agendar pelos horários disponíveis na agenda
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Horários com menos de {getLabel(advanceHours)} de antecedência serão bloqueados 
            automaticamente na agenda, impedindo novos agendamentos.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="advance-hours">
            Antecedência mínima
          </Label>
          <Select 
            value={advanceHours} 
            onValueChange={setAdvanceHours}
          >
            <SelectTrigger id="advance-hours" className="w-full">
              <SelectValue placeholder="Selecione o limite" />
            </SelectTrigger>
            <SelectContent>
              {OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Configuração atual: <strong>{getLabel(advanceHours)}</strong>
          </p>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving} 
          className="w-full sm:w-auto"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Configuração
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
