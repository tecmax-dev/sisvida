import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Timer, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface WhatsAppDelayConfigProps {
  clinicId: string;
}

const DELAY_RECOMMENDATIONS = [
  { min: 5, max: 9, level: "danger", label: "Risco Alto", color: "text-destructive", description: "Muito rápido, alto risco de banimento" },
  { min: 10, max: 15, level: "warning", label: "Moderado", color: "text-amber-600", description: "Intervalo recomendado para uso normal" },
  { min: 16, max: 30, level: "safe", label: "Seguro", color: "text-emerald-600", description: "Intervalo seguro, menor velocidade" },
  { min: 31, max: 60, level: "very-safe", label: "Muito Seguro", color: "text-emerald-700", description: "Intervalo conservador" },
];

export function WhatsAppDelayConfig({ clinicId }: WhatsAppDelayConfigProps) {
  const [delaySeconds, setDelaySeconds] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [clinicId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("clinics")
        .select("whatsapp_message_delay_seconds")
        .eq("id", clinicId)
        .single();

      if (error) throw error;
      
      if (data?.whatsapp_message_delay_seconds) {
        setDelaySeconds(data.whatsapp_message_delay_seconds);
      }
    } catch (error) {
      console.error("Error loading WhatsApp delay config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelayChange = async (value: number[]) => {
    const newDelay = value[0];
    setDelaySeconds(newDelay);
    
    // Debounce save
    setSaving(true);
    try {
      const { error } = await supabase
        .from("clinics")
        .update({ whatsapp_message_delay_seconds: newDelay })
        .eq("id", clinicId);

      if (error) throw error;
      
      toast.success(`Intervalo atualizado para ${newDelay} segundos`);
    } catch (error: any) {
      console.error("Error saving delay:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const getRiskLevel = (seconds: number) => {
    return DELAY_RECOMMENDATIONS.find(r => seconds >= r.min && seconds <= r.max) 
      || DELAY_RECOMMENDATIONS[DELAY_RECOMMENDATIONS.length - 1];
  };

  const currentRisk = getRiskLevel(delaySeconds);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Intervalo de Disparo WhatsApp
        </CardTitle>
        <CardDescription>
          Configure o intervalo entre mensagens de marketing para evitar banimento
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Risk indicator */}
        <div className={`flex items-center gap-3 p-4 rounded-lg border ${
          currentRisk.level === "danger" ? "bg-destructive/10 border-destructive/30" :
          currentRisk.level === "warning" ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800" :
          "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
        }`}>
          {currentRisk.level === "danger" ? (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          ) : (
            <CheckCircle2 className={`h-5 w-5 ${currentRisk.color}`} />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`font-medium ${currentRisk.color}`}>
                {currentRisk.label}
              </span>
              <Badge variant="outline" className="text-xs">
                {delaySeconds}s
              </Badge>
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
            <p className="text-sm text-muted-foreground">{currentRisk.description}</p>
          </div>
        </div>

        {/* Slider */}
        <div className="space-y-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>5s (rápido)</span>
            <span>60s (conservador)</span>
          </div>
          
          <Slider
            value={[delaySeconds]}
            onValueChange={handleDelayChange}
            min={5}
            max={60}
            step={5}
            className="w-full"
          />
          
          <div className="grid grid-cols-4 gap-2 text-xs">
            {DELAY_RECOMMENDATIONS.map((rec) => (
              <div 
                key={rec.level}
                className={`text-center p-2 rounded ${
                  delaySeconds >= rec.min && delaySeconds <= rec.max 
                    ? "bg-muted" 
                    : ""
                }`}
              >
                <span className={rec.color}>{rec.min}-{rec.max}s</span>
              </div>
            ))}
          </div>
        </div>

        {/* Explanation */}
        <div className="text-sm text-muted-foreground space-y-2 pt-4 border-t">
          <p className="font-medium">⚠️ Atenção ao enviar mensagens em massa:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>O WhatsApp pode bloquear números que enviam muitas mensagens rapidamente</li>
            <li>Intervalos maiores reduzem o risco, mas aumentam o tempo total de envio</li>
            <li>Recomendamos intervalos de 10-20 segundos para uso regular</li>
            <li>Para lotes grandes (50+ mensagens), use 20-30 segundos</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
