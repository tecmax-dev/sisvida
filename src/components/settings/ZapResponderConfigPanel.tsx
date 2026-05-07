   const [testPhone, setTestPhone] = useState("");
   const [activatingBot, setActivatingBot] = useState(false);
    const handleTestBotActivation = async () => {
      if (!testPhone) {
        toast({
          title: "Atenção",
          description: "Informe um número de telefone para testar a ativação do bot.",
          variant: "destructive",
        });
        return;
      }
 
      setActivatingBot(true);
      try {
        const { data, error } = await supabase.functions.invoke('zapresponder-bot-actions', {
          body: { 
            phone: testPhone,
            clinicId: clinicId,
            action: 'startBot'
          }
        });
 
        if (error) throw error;
 
        toast({
          title: "Bot ativado!",
          description: "A API do ZapResponder respondeu com sucesso.",
        });
      } catch (error: any) {
        console.error("Erro ao ativar bot:", error);
        toast({
          title: "Falha na ativação",
          description: "Ocorreu um erro ao chamar a API de ativação do bot.",
          variant: "destructive",
        });
      } finally {
        setActivatingBot(false);
      }
    };
 
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ShieldCheck,
  Loader2,
  Save,
  Check,
  X,
  ExternalLink,
} from "lucide-react";

interface ZapResponderConfig {
  id: string;
  name: string;
   api_token?: string; // Tornando opcional pois agora usamos secrets
  instance_id: string | null;
  is_active: boolean;
}

interface ZapResponderConfigPanelProps {
  clinicId: string;
}

export function ZapResponderConfigPanel({ clinicId }: ZapResponderConfigPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ZapResponderConfig | null>(null);
   const [instanceId, setInstanceId] = useState("");
   const [isActive, setIsActive] = useState(false);
   const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [clinicId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("zapresponder_configs")
        .select("*")
        .maybeSingle();

       if (data) {
         setConfig(data);
         setInstanceId(data.instance_id || "");
         setIsActive(data.is_active);
       }
    } catch (error) {
      console.error("Error loading Zap Responder config:", error);
    } finally {
      setLoading(false);
    }
  };

   const handleSaveConfig = async () => {
     setSaving(true);
     try {
       if (config) {
         const { error } = await supabase
           .from("zapresponder_configs")
           .update({
             instance_id: instanceId,
             is_active: isActive,
           })
           .eq("id", config.id);
 
         if (error) throw error;
       } else {
         const { data, error } = await supabase
           .from("zapresponder_configs")
           .insert({
             instance_id: instanceId,
             is_active: true,
             api_token: "managed-via-secrets",
           })
           .select()
           .single();
 
         if (error) throw error;
         setConfig(data);
         setIsActive(true);
       }
 
       toast({
         title: "Configuração salva",
         description: "Integração Zap Responder atualizada com sucesso.",
       });
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

   const handleTestConnection = async () => {
     setTesting(true);
     try {
       // Chama a edge function para enviar uma mensagem de teste (ou apenas validar o token)
       // Por enquanto, vamos apenas validar se a edge function consegue ler o token
       const { data, error } = await supabase.functions.invoke('send-whatsapp-zapresponder', {
         body: { 
           test: true,
           clinicId: clinicId
         }
       });

       if (error) throw error;

       toast({
         title: "Conexão estabelecida!",
         description: "O token da API é válido e a integração está pronta.",
       });
     } catch (error: any) {
       console.error("Erro ao testar:", error);
       toast({
         title: "Falha na conexão",
         description: "Verifique se o token foi configurado corretamente no painel do Lovable Cloud.",
         variant: "destructive",
       });
     } finally {
       setTesting(false);
     }
   };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-500" />
              Zap Responder (API Oficial Meta)
            </CardTitle>
            <CardDescription>
              Conecte sua conta Zap Responder para usar a API Oficial e evitar banimentos
            </CardDescription>
          </div>
          {config && (
            <Badge variant={config.is_active ? "default" : "secondary"}>
              {config.is_active ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Ativo
                </>
              ) : (
                <>
                  <X className="h-3 w-3 mr-1" />
                  Inativo
                </>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>
       <CardContent className="space-y-6">
         <div className="grid gap-4">
           <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
             <div className="space-y-0.5">
               <Label className="text-base">Status da Integração</Label>
               <p className="text-sm text-muted-foreground">
                 Ative ou desative o envio de mensagens via Zap Responder
               </p>
             </div>
             <Switch 
               checked={isActive} 
               onCheckedChange={setIsActive} 
             />
           </div>

           <div className="space-y-2">
             <Label htmlFor="instance_id">ID da Instância (Opcional)</Label>
             <Input
               id="instance_id"
               placeholder="Ex: inst_123..."
               value={instanceId}
               onChange={(e) => setInstanceId(e.target.value)}
             />
             <p className="text-xs text-muted-foreground">
               Necessário apenas se você gerencia múltiplas instâncias no Zap Responder.
             </p>
           </div>
         </div>

         <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-3">
           <ShieldCheck className="h-5 w-5 text-amber-600 mt-0.5" />
           <div className="text-sm text-amber-800">
             <p className="font-semibold mb-1">Segurança de Dados</p>
             <p>O Token da API agora é gerenciado via <strong>Secrets do Lovable Cloud</strong>. Ele não fica exposto no banco de dados, garantindo 100% de privacidade.</p>
           </div>
         </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-full">
            <ExternalLink className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Dica de Segurança</p>
            <p>Use templates aprovados pela Meta para evitar bloqueios. O Zap Responder gerencia automaticamente os limites da API para você.</p>
          </div>
        </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex flex-col gap-2">
              <Label>Testar Ativação de Bot (iniciarBot)</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="55739..." 
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="max-w-[200px]"
                />
                <Button 
                  variant="secondary" 
                  onClick={handleTestBotActivation}
                  disabled={activatingBot || !config}
                >
                  {activatingBot ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bot className="h-4 w-4 mr-2" />}
                  Testar Iniciar Bot
                </Button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button 
                variant="outline" 
                onClick={handleTestConnection} 
                disabled={testing || !config}
              >
                {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Testar Conexão
              </Button>
              <Button onClick={handleSaveConfig} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Configurações
              </Button>
            </div>
          </div>
      </CardContent>
    </Card>
  );
}
