import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Zap, Check, ShieldCheck, BadgeCheck, Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface WhatsAppProviderSelectorProps {
  clinicId: string;
  onProviderChange?: (provider: string) => void;
}

export function WhatsAppProviderSelector({ clinicId, onProviderChange }: WhatsAppProviderSelectorProps) {
  const { toast } = useToast();
  const [provider, setProvider] = useState<string>("evolution");
  const [loading, setLoading] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [evolutionConnected, setEvolutionConnected] = useState(false);
  const [twilioConnected, setTwilioConnected] = useState(false);
  const [zapResponderConnected, setZapResponderConnected] = useState(false);

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

      // Check Zap Responder connection (via Zapster API)
      const { data: zapData } = await supabase
        .from("zapster_configs")
        .select("is_connected, is_active")
        .eq("clinic_id", clinicId)
        .maybeSingle();

      setZapResponderConnected(!!zapData?.is_active && !!zapData?.is_connected);
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

      const providerLabels: Record<string, string> = {
        evolution: "Evolution API",
        twilio: "Twilio",
        zapresponder: "Zap Responder (API Oficial)",
        meta_official: "Meta Cloud API (Oficial)",
      };
      toast({
        title: "Provedor alterado",
        description: `WhatsApp agora usa ${providerLabels[newProvider] ?? newProvider}`,
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

  const handleSendTest = async () => {
    if (!testPhone) {
      toast({
        title: "Atenção",
        description: "Informe um número de telefone para o teste",
        variant: "destructive",
      });
      return;
    }

    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          phone: testPhone,
          message: "Este é um envio de teste do sistema Prosinge para validar sua configuração de WhatsApp.",
          clinicId: clinicId,
          type: "custom",
          sendAsTextOnly: true
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");

      toast({
        title: "Teste enviado",
        description: "Verifique o WhatsApp do número informado.",
      });
    } catch (error: any) {
      console.error("Error sending test:", error);
      toast({
        title: "Falha no teste",
        description: error.message || "Erro ao enviar mensagem de teste",
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
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
              value="meta_official"
              id="meta_official"
              className="peer sr-only"
            />
            <Label
              htmlFor="meta_official"
              className="flex flex-col items-start gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-emerald-600" />
                  <span className="font-semibold">Meta Cloud (Oficial)</span>
                </div>
                <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                  Recomendado
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                <ul className="space-y-1">
                  <li>• API oficial direta com a Meta</li>
                  <li>• Número verificado (selo verde)</li>
                  <li>• Templates aprovados pela Meta</li>
                  <li>• Botões interativos sempre funcionam</li>
                </ul>
              </div>
            </Label>
          </div>

          <div className="relative">
            <RadioGroupItem
              value="zapresponder"
              id="zapresponder"
              className="peer sr-only"
            />
            <Label
              htmlFor="zapresponder"
              className="flex flex-col items-start gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-blue-500" />
                  <span className="font-semibold">Zap Responder</span>
                </div>
                {zapResponderConnected && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    Conectado
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                <ul className="space-y-1">
                  <li>• API Oficial (Anti-Ban)</li>
                  <li>• Atendimento Humano Integrado</li>
                  <li>• Templates para automações</li>
                  <li>• Alta confiabilidade</li>
                </ul>
              </div>
            </Label>
          </div>

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
      <CardFooter className="flex flex-col items-start gap-4 border-t pt-6">
        <div className="w-full space-y-2">
          <Label htmlFor="test_phone" className="text-sm font-medium">
            Validar Configuração (Envio de Teste)
          </Label>
          <div className="flex gap-2">
            <Input
              id="test_phone"
              placeholder="DDD + Número (ex: 73988633535)"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value.replace(/\D/g, ""))}
              className="max-w-[300px]"
            />
            <Button 
              onClick={handleSendTest} 
              disabled={sendingTest || !testPhone}
              className="gap-2"
            >
              {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar Teste
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            O sistema enviará uma mensagem simples para validar a conexão com o provedor selecionado acima.
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}
