import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Zap, Check } from "lucide-react";

interface WhatsAppProviderSelectorProps {
  clinicId: string;
  onProviderChange?: (provider: string) => void;
}

export function WhatsAppProviderSelector({ clinicId, onProviderChange }: WhatsAppProviderSelectorProps) {
  const { toast } = useToast();
  const [provider, setProvider] = useState<string>("evolution");
  const [loading, setLoading] = useState(true);
  const [evolutionConnected, setEvolutionConnected] = useState(false);
  const [twilioConnected, setTwilioConnected] = useState(false);

  useEffect(() => {
    loadProviderConfig();
  }, [clinicId]);

  const loadProviderConfig = async () => {
    try {
      setLoading(true);

      // Load current provider from clinic
      const { data: clinicData } = await supabase
        .from("clinics")
        .select("whatsapp_provider")
        .eq("id", clinicId)
        .single();

      if (clinicData?.whatsapp_provider) {
        setProvider(clinicData.whatsapp_provider);
      }

      // Check Evolution connection
      const { data: evolutionData } = await supabase
        .from("evolution_configs")
        .select("is_connected")
        .eq("clinic_id", clinicId)
        .maybeSingle();

      setEvolutionConnected(evolutionData?.is_connected || false);

      // Check Twilio connection
      const { data: twilioData } = await supabase
        .from("twilio_configs")
        .select("is_connected")
        .eq("clinic_id", clinicId)
        .maybeSingle();

      setTwilioConnected(twilioData?.is_connected || false);
    } catch (error) {
      console.error("Error loading provider config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = async (newProvider: string) => {
    try {
      const { error } = await supabase
        .from("clinics")
        .update({ whatsapp_provider: newProvider })
        .eq("id", clinicId);

      if (error) throw error;

      setProvider(newProvider);
      onProviderChange?.(newProvider);

      toast({
        title: "Provedor alterado",
        description: `WhatsApp agora usa ${newProvider === "evolution" ? "Evolution API" : "Twilio"}`,
      });
    } catch (error: any) {
      console.error("Error changing provider:", error);
      toast({
        title: "Erro",
        description: "Erro ao alterar provedor",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Provedor WhatsApp
        </CardTitle>
        <CardDescription>
          Escolha qual provedor usar para enviar mensagens WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={provider}
          onValueChange={handleProviderChange}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="relative">
            <RadioGroupItem
              value="evolution"
              id="evolution"
              className="peer sr-only"
            />
            <Label
              htmlFor="evolution"
              className="flex flex-col items-start gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  <span className="font-semibold">Evolution API</span>
                </div>
                {evolutionConnected && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    Conectado
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                <ul className="space-y-1">
                  <li>• Gratuito (auto-hospedado)</li>
                  <li>• Configuração via QR Code</li>
                  <li>• Sem aprovação de templates</li>
                  <li>• Botões podem não funcionar em alguns dispositivos</li>
                </ul>
              </div>
            </Label>
          </div>

          <div className="relative">
            <RadioGroupItem
              value="twilio"
              id="twilio"
              className="peer sr-only"
            />
            <Label
              htmlFor="twilio"
              className="flex flex-col items-start gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-red-500" />
                  <span className="font-semibold">Twilio</span>
                </div>
                {twilioConnected && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    Conectado
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                <ul className="space-y-1">
                  <li>• API oficial da Meta</li>
                  <li>• Botões interativos funcionam sempre</li>
                  <li>• Requer aprovação de templates</li>
                  <li>• Custo por mensagem</li>
                </ul>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
