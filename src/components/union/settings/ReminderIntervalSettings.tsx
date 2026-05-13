import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageSquare, Save, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReminderIntervalSettingsProps {
  clinicId: string;
  currentValue?: number;
  onUpdate?: () => void;
  isAdmin?: boolean;
}

const OPTIONS = [
  { value: "10", label: "10 segundos" },
  { value: "30", label: "30 segundos" },
  { value: "60", label: "60 segundos (padrão)" },
  { value: "120", label: "2 minutos" },
  { value: "180", label: "3 minutos" },
  { value: "300", label: "5 minutos" },
];

export function ReminderIntervalSettings({ clinicId, currentValue = 60, onUpdate, isAdmin = false }: ReminderIntervalSettingsProps) {
  const [interval, setIntervalValue] = useState(currentValue.toString());
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Ocultar completamente para não-admins
  if (!isAdmin) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("clinics")
        .update({ reminder_interval: parseInt(interval) })
        .eq("id", clinicId);

      if (error) throw error;

      toast({
        title: "Configuração salva",
        description: "O intervalo entre os lembretes de WhatsApp foi atualizado.",
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
    return OPTIONS.find(o => o.value === value)?.label || `${value} segundos`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Intervalo entre Lembretes de WhatsApp
        </CardTitle>
        <CardDescription>
          Define o tempo de espera entre o envio de um lembrete e o próximo para evitar bloqueios no WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Aumentar o intervalo ajuda a evitar que o WhatsApp identifique os envios como spam. 
            O sistema aguardará {getLabel(interval)} entre cada mensagem.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="reminder-interval">
            Intervalo de envio
          </Label>
          <Select 
            value={interval} 
            onValueChange={setIntervalValue}
          >
            <SelectTrigger id="reminder-interval" className="w-full">
              <SelectValue placeholder="Selecione o intervalo" />
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
            Configuração atual: <strong>{getLabel(interval)}</strong>
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