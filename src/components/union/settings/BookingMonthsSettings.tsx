import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Calendar, Save, Info, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BookingMonthsSettingsProps {
  clinicId: string;
  currentValue?: number;
  onUpdate?: () => void;
  isAdmin?: boolean;
}

export function BookingMonthsSettings({ clinicId, currentValue = 1, onUpdate, isAdmin = false }: BookingMonthsSettingsProps) {
  const [bookingMonthsAhead, setBookingMonthsAhead] = useState(currentValue.toString());
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  
  const canEdit = isAdmin;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("clinics")
        .update({ booking_months_ahead: parseInt(bookingMonthsAhead) })
        .eq("id", clinicId);

      if (error) throw error;

      toast({
        title: "Configuração salva",
        description: "O limite de meses para agendamento foi atualizado.",
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

  const getMonthLabel = (value: string) => {
    const num = parseInt(value);
    if (num === 1) return "Apenas mês atual";
    if (num === 2) return "Mês atual + próximo mês";
    return `Até ${num} meses à frente`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Limite de Agendamento
        </CardTitle>
        <CardDescription>
          Configure quantos meses à frente os associados podem visualizar e agendar consultas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canEdit && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <Lock className="h-4 w-4" />
            <AlertDescription className="font-medium">
              Agendamento indisponível para edição. Apenas administradores podem alterar esta configuração.
            </AlertDescription>
          </Alert>
        )}
        
        {canEdit && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Esta configuração afeta o calendário de agendamento no aplicativo mobile. 
              Os associados só poderão ver e selecionar datas dentro do período configurado.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="booking-months" className={!canEdit ? "text-muted-foreground" : ""}>
            Meses disponíveis para agendamento
          </Label>
          <Select 
            value={bookingMonthsAhead} 
            onValueChange={setBookingMonthsAhead}
            disabled={!canEdit}
          >
            <SelectTrigger 
              id="booking-months" 
              className={`w-full ${!canEdit ? "opacity-60 cursor-not-allowed bg-muted" : ""}`}
              disabled={!canEdit}
            >
              <SelectValue placeholder="Selecione o limite" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Apenas mês atual</SelectItem>
              <SelectItem value="2">Mês atual + próximo mês</SelectItem>
              <SelectItem value="3">Até 3 meses</SelectItem>
              <SelectItem value="6">Até 6 meses</SelectItem>
              <SelectItem value="12">Até 12 meses</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Configuração atual: <strong>{getMonthLabel(bookingMonthsAhead)}</strong>
          </p>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving || !canEdit} 
          className={`w-full sm:w-auto ${!canEdit ? "opacity-60 cursor-not-allowed" : ""}`}
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
