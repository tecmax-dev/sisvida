import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface N8nConfigForm {
  n8n_url: string;
  api_key: string;
}

export const N8nIntegrationConfig = ({ clinicId }: { clinicId: string }) => {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const { register, handleSubmit, setValue } = useForm<N8nConfigForm>();

  useEffect(() => {
    if (clinicId) loadConfig();
  }, [clinicId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("n8n_configs" as any)
        .select("*")
        .eq("clinic_id", clinicId)
        .maybeSingle();

      if (data) {
        setConfig(data);
        setValue("n8n_url", (data as any).n8n_url);
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: N8nConfigForm) => {
    setLoading(true);
    try {
      const secretName = `N8N_API_KEY_${clinicId.replace(/-/g, '_')}`;
      
      const { error: dbError } = await supabase.from("n8n_configs" as any).upsert({
        clinic_id: clinicId,
        n8n_url: data.n8n_url.trim().replace(/\/$/, ""),
        n8n_api_token_secret_name: secretName,
        connection_status: 'CONFIGURED'
      }, { onConflict: 'clinic_id' });
      
      if (dbError) throw dbError;

      if (data.api_key) {
        // Enviar para a edge function para notificar a intenção de salvamento
        const { error: secretError } = await supabase.functions.invoke('chatwoot-integration', {
          body: { 
            clinicId, 
            action: 'save-secret', 
            secretName, 
            token: data.api_key // O backend registra a intenção, mas não deve logar este valor
          }
        });
        
        if (secretError) {
          console.error("Erro ao notificar backend:", secretError);
        }
        
        // Limpar o campo de senha após sucesso para segurança do frontend
        setValue("api_key", "");
        toast.success("Configurações do n8n atualizadas. A API Key foi enviada ao cofre seguro.");
      } else {
        toast.success("Configuração do n8n atualizada.");
      }
      
      loadConfig();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('chatwoot-integration', {
        body: { 
          clinicId, 
          action: 'test-n8n-connection' 
        }
      });

      if (error) {
        toast.error(`Erro na conexão: ${error.message || 'Falha na requisição'}`);
        return;
      }

      if (data?.ok) {
        toast.success("Conexão PROSINGE → n8n: CONNECTED");
        loadConfig();
      } else {
        const httpStatus = data?.httpStatus || 'N/A';
        let errorMsg = "Erro na conexão";
        
        if (httpStatus === 401 || httpStatus === 403) errorMsg = `Erro ${httpStatus}: Autenticação/Permissão inválida`;
        else if (httpStatus === 404) errorMsg = `Erro ${httpStatus}: Endpoint ou Base URL incorretos`;
        else errorMsg = `Erro ${httpStatus}: ${data?.message || 'Falha de conectividade'}`;
        
        toast.error(errorMsg);
      }
    } catch (err: any) {
      toast.error(`Erro inesperado: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  if (loading && !config) return <Loader2 className="animate-spin m-8" />;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Integração n8n</CardTitle>
            <CardDescription>Configure a URL e API Key para orquestração de fluxos via n8n.</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              {config?.connection_status === 'CONNECTED' ? (
                <CheckCircle2 className="text-green-500 h-4 w-4" />
              ) : (
                <AlertCircle className="text-yellow-500 h-4 w-4" />
              )}
              <span className="text-xs font-bold uppercase tracking-wider">
                {config?.connection_status === 'CONNECTED' ? '🟢 CONECTADO' : 
                 config?.connection_status === 'CONFIGURED' ? '🟡 CONFIGURADO' : 
                 '🔴 NÃO CONFIGURADO'}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase font-medium">PROSINGE → n8n</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-base font-semibold">URL do n8n</Label>
            <Input 
              placeholder="https://n8n.seu-dominio.com" 
              {...register("n8n_url", { required: true })} 
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base font-semibold">API Key</Label>
            <Input 
              type="password" 
              placeholder={config?.n8n_api_token_secret_name ? "API KEY CONFIGURADA" : "Insira a API Key do n8n"} 
              {...register("api_key", { required: !config?.n8n_api_token_secret_name })} 
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Obtida nas configurações de usuário do seu n8n.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t">
            <Button type="submit" disabled={loading} className="flex-1 h-11 bg-[#16a394] hover:bg-[#138d80]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              SALVAR CONFIGURAÇÃO
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={testConnection} 
              disabled={!config || testing} 
              className="flex-1 h-11"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              TESTAR CONEXÃO
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};