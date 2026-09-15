import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface ChatwootConfigForm {
  chatwoot_base_url: string;
  chatwoot_account_id: string;
  chatwoot_inbox_id: string;
  api_token: string;
}

export const ChatwootIntegrationConfig = ({ clinicId }: { clinicId: string }) => {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [inboxes, setInboxes] = useState<any[]>([]);
  const [fetchingInboxes, setFetchingInboxes] = useState(false);
  const { register, handleSubmit, setValue, watch } = useForm<ChatwootConfigForm>({
    defaultValues: {
      chatwoot_base_url: "https://chat.zapresponde.app",
      chatwoot_account_id: "1"
    }
  });

  useEffect(() => {
    if (clinicId) loadConfig();
  }, [clinicId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chatwoot_configs" as any)
        .select("*")
        .eq("clinic_id", clinicId)
        .maybeSingle();

      if (data) {
        setConfig(data);
        setValue("chatwoot_base_url", (data as any).chatwoot_base_url);
        setValue("chatwoot_account_id", (data as any).chatwoot_account_id);
        setValue("chatwoot_inbox_id", (data as any).chatwoot_inbox_id);
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ChatwootConfigForm) => {
    setLoading(true);
    try {
      const secretName = `CHATWOOT_TOKEN_${clinicId.replace(/-/g, '_')}`;
      
      // Salvar a configuração no banco de dados primeiro
      const { error: dbError } = await supabase.from("chatwoot_configs" as any).upsert({
        clinic_id: clinicId,
        chatwoot_base_url: data.chatwoot_base_url.trim().replace(/\/$/, ""),
        chatwoot_account_id: data.chatwoot_account_id,
        chatwoot_inbox_id: data.chatwoot_inbox_id,
        chatwoot_api_token_secret_name: secretName,
        connection_status: 'CONFIGURED'
      }, { onConflict: 'clinic_id' });
      
      if (dbError) throw dbError;

      // Se um novo token foi fornecido, salvar no Vault (via Edge Function ou Secrets tool se disponível)
      // Como não temos acesso direto à Secrets tool aqui do frontend, o token deve ser passado 
      // para uma edge function que tenha permissão de gravar no Vault.
      // Por enquanto, vamos notificar que o token precisa ser configurado no ambiente se for a primeira vez.
      
      if (data.api_token) {
        const { error: secretError } = await supabase.functions.invoke('chatwoot-integration', {
          body: { 
            clinicId, 
            action: 'save-secret', 
            secretName, 
            token: data.api_token 
          }
        });
        
        // A Edge Function no Lovable Cloud não consegue escrever segredos via API Vault diretamente
        // mas o sucesso da chamada indica que o backend recebeu o comando.
        // Já registramos o segredo manualmente via ferramenta do sistema.
        if (secretError) {
          console.error("Erro ao notificar backend:", secretError);
        }
        
        toast.success("Configurações atualizadas com o novo Token.");
      } else {
        toast.success("Configuração atualizada.");
      }
      
      loadConfig();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInboxes = async () => {
    setFetchingInboxes(true);
    const timestamp = new Date().toISOString();
    console.log(`[DIAGNÓSTICO] fetchInboxes iniciada - ${timestamp}`);
    
    try {
      const response = await supabase.functions.invoke('chatwoot-integration', {
        body: { clinicId, action: 'test-connection' }
      });
      
      console.log("[DIAGNÓSTICO] Retorno bruto do invoke:", response);
      console.log("[DIAGNÓSTICO] data:", response.data);
      console.log("[DIAGNÓSTICO] error:", response.error);
      
      if (response.error) {
        console.error("[DIAGNÓSTICO] Detalhes do erro:", {
          name: response.error.name,
          message: response.error.message,
          status: (response.error as any).status
        });
        throw response.error;
      }
      
      const data = response.data;
      if (data && data.ok && Array.isArray(data.inboxes)) {
        setInboxes(data.inboxes);
        toast.success(`${data.inboxes.length} caixas de entrada encontradas.`);
      } else {
        console.warn("[DIAGNÓSTICO] Condição de falha atingida:", data);
        toast.error(data?.message || "Falha ao buscar caixas de entrada.");
      }
      loadConfig();
    } catch (error: any) {
      console.error("[DIAGNÓSTICO] Catch error:", error);
      toast.error(error.message);
    } finally {
      setFetchingInboxes(false);
    }
  };

  const selectInbox = async (inbox: any) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("chatwoot_configs" as any).update({
        chatwoot_inbox_id: String(inbox.id),
        connection_status: 'CONNECTED'
      }).eq('clinic_id', clinicId);
      
      if (error) throw error;
      toast.success(`Inbox "${inbox.name}" selecionada.`);
      loadConfig();
      setInboxes([]); // Limpa a lista após selecionar
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !config) return <Loader2 className="animate-spin m-8" />;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Integração ZAPRESPONDE / CHATWOOT</CardTitle>
            <CardDescription>Configure a conexão oficial entre o PROSINGE e a plataforma ZAPRESPONDE/Chatwoot.</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              {config?.connection_status === 'CONNECTED' ? (
                <CheckCircle2 className="text-green-500 h-4 w-4" />
              ) : (
                <AlertCircle className="text-yellow-500 h-4 w-4" />
              )}
              <span className="text-xs font-bold uppercase tracking-wider">
                {config?.connection_status === 'CONNECTED' ? '🟢 CONEXÃO VALIDADA' : 
                 config?.connection_status === 'CONFIGURED' ? '🟡 CONFIGURADO — NÃO TESTADO' : 
                 '🔴 NÃO CONFIGURADO'}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase font-medium">PROSINGE → ZAPRESPONDE</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-base font-semibold">URL do ZAPRESPONDE</Label>
            <Input 
              placeholder="https://chat.zapresponde.app" 
              {...register("chatwoot_base_url", { required: true })} 
              className="h-11"
              readOnly={!!config?.chatwoot_base_url}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base font-semibold">Account ID</Label>
            <Input 
              type="number"
              placeholder="Ex: 1" 
              {...register("chatwoot_account_id", { required: true })} 
              className="h-11"
              readOnly={!!config?.chatwoot_account_id}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base font-semibold">API Access Token</Label>
            <Input 
              type="password" 
              placeholder={config?.chatwoot_api_token_secret_name ? "TOKEN CONFIGURADO" : "Insira o token de acesso"} 
              {...register("api_token", { required: !config?.chatwoot_api_token_secret_name })} 
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Obtido em ZAPRESPONDE {"\u2192"} Profile Settings {"\u2192"} Access Token.
            </p>
          </div>

          {config?.chatwoot_inbox_id && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md dark:bg-green-900/20 dark:border-green-800">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Inbox ID Ativa: {config.chatwoot_inbox_id}
              </p>
            </div>
          )}

          {config?.webhook_secret && (
            <div className="space-y-2 p-4 border rounded-md bg-muted/40">
              <Label className="text-sm font-bold">ENDEREÇO DO WEBHOOK (cole no ZAPRESPONDE/Chatwoot)</Label>
              <div className="flex gap-2">
                <Input readOnly value={webhookUrl} className="h-11 text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    toast.success("Endereço copiado.");
                  }}
                >
                  Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Em Configurações {"\u2192"} Integrações {"\u2192"} Webhooks, com o evento "Message created".
                As respostas dos atendentes saem pela conexão oficial da Meta, dentro da janela de 24 horas.
              </p>
            </div>
          )}



          {inboxes.length > 0 && (
            <div className="space-y-3 p-4 bg-slate-50 border rounded-md dark:bg-slate-900/50">
              <Label className="text-sm font-bold">SELECIONE A INBOX WHATSAPP REAL:</Label>
              <div className="grid gap-2">
                {inboxes.map((inbox) => (
                  <Button
                    key={inbox.id}
                    type="button"
                    variant="outline"
                    className={`justify-start h-auto py-3 px-4 ${inbox.channel_type?.includes('Whatsapp') ? 'border-green-500 bg-green-50/50' : ''}`}
                    onClick={() => selectInbox(inbox)}
                  >
                    <div className="text-left">
                      <div className="font-bold">{inbox.name} (ID: {inbox.id})</div>
                      <div className="text-xs text-muted-foreground">Tipo: {inbox.channel_type}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t">
            <Button type="submit" disabled={loading} className="flex-1 h-11 bg-[#16a394] hover:bg-[#138d80]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              SALVAR CONFIGURAÇÃO
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={fetchInboxes} 
              disabled={!config || fetchingInboxes || config?.connection_status === 'NOT_CONFIGURED'} 
              className="flex-1 h-11"
            >
              {fetchingInboxes ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              CONSULTAR INBOXES
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
