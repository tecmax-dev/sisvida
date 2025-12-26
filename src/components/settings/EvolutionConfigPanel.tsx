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
  MessageSquare,
  Loader2,
  Save,
  RefreshCw,
  QrCode,
  Check,
  X,
  Unplug,
  Plug,
  Webhook,
} from "lucide-react";

interface EvolutionConfig {
  id: string;
  clinic_id: string;
  instance_name: string;
  api_url: string;
  api_key: string;
  is_connected: boolean;
  connected_at: string | null;
  phone_number: string | null;
  qr_code: string | null;
  direct_reply_enabled: boolean;
  webhook_url: string | null;
}

interface EvolutionConfigPanelProps {
  clinicId: string;
}

export function EvolutionConfigPanel({ clinicId }: EvolutionConfigPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [generatingQR, setGeneratingQR] = useState(false);
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [config, setConfig] = useState<EvolutionConfig | null>(null);
  const [form, setForm] = useState({
    instance_name: "",
    api_url: "",
    api_key: "",
  });

  useEffect(() => {
    loadConfig();
  }, [clinicId]);

  // Verificar status real da conexão periodicamente
  useEffect(() => {
    if (!config || !config.is_connected) return;

    // Verificar status real ao carregar se estiver "conectado"
    checkRealConnectionStatus();

    // Verificar a cada 30 segundos
    const interval = setInterval(checkRealConnectionStatus, 30000);
    return () => clearInterval(interval);
  }, [config?.id, config?.is_connected]);

  const checkRealConnectionStatus = async () => {
    if (!config) return;
    
    try {
      const { data: result, error } = await supabase.functions.invoke('evolution-api', {
        body: { clinicId, action: 'connectionState' },
      });

      if (error) {
        console.error('[EvolutionConfig] Error checking status:', error);
        return;
      }
      
      const isConnected = 
        result?.data?.instance?.state === "open" ||
        result?.data?.state === "open" ||
        result?.data?.status === "CONNECTED" ||
        result?.data?.instance?.status === "CONNECTED";

      // Se o status mudou, atualizar o banco e o estado local
      if (isConnected !== config.is_connected) {
        console.log(`[EvolutionConfig] Status changed: ${config.is_connected} -> ${isConnected}`);
        
        await supabase
          .from("evolution_configs")
          .update({
            is_connected: isConnected,
            connected_at: isConnected ? new Date().toISOString() : null,
            phone_number: isConnected ? result?.data?.instance?.phoneNumber : null,
          })
          .eq("id", config.id);

        setConfig({
          ...config,
          is_connected: isConnected,
          connected_at: isConnected ? new Date().toISOString() : null,
          phone_number: isConnected ? result?.data?.instance?.phoneNumber : null,
        });

        if (!isConnected) {
          toast({
            title: "WhatsApp Desconectado",
            description: "A conexão foi perdida. Escaneie o QR Code novamente.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('[EvolutionConfig] Error in checkRealConnectionStatus:', error);
    }
  };

  const loadConfig = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from("evolution_configs")
      .select("*")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (data) {
      setConfig({
        ...data,
        direct_reply_enabled: data.direct_reply_enabled ?? false,
        webhook_url: data.webhook_url ?? null,
      } as EvolutionConfig);
      setForm({
        instance_name: data.instance_name,
        api_url: data.api_url,
        api_key: data.api_key,
      });
    }
    
    setLoading(false);
  };

  const handleSaveConfig = async () => {
    if (!form.instance_name || !form.api_url || !form.api_key) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos para continuar.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      if (config) {
        // Update existing
        const { error } = await supabase
          .from("evolution_configs")
          .update({
            instance_name: form.instance_name,
            api_url: form.api_url.replace(/\/$/, ""), // Remove trailing slash
            api_key: form.api_key,
          })
          .eq("id", config.id);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from("evolution_configs")
          .insert({
            clinic_id: clinicId,
            instance_name: form.instance_name,
            api_url: form.api_url.replace(/\/$/, ""),
            api_key: form.api_key,
          })
          .select()
          .single();

        if (error) throw error;
        setConfig(data);
      }

      toast({
        title: "Configuração salva",
        description: "Configuração da Evolution API atualizada com sucesso.",
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

  const handleCheckConnection = async () => {
    if (!config) return;
    
    setChecking(true);

    try {
      const { data: result, error } = await supabase.functions.invoke('evolution-api', {
        body: { clinicId, action: 'connectionState' },
      });

      if (error) throw error;
      
      if (!result?.success) {
        throw new Error(result?.error || 'Erro ao verificar conexão');
      }

      const isConnected = result?.data?.instance?.state === "open";

      await supabase
        .from("evolution_configs")
        .update({
          is_connected: isConnected,
          connected_at: isConnected ? new Date().toISOString() : null,
          phone_number: result?.data?.instance?.phoneNumber || null,
        })
        .eq("id", config.id);

      setConfig({
        ...config,
        is_connected: isConnected,
        connected_at: isConnected ? new Date().toISOString() : null,
        phone_number: result?.data?.instance?.phoneNumber || null,
      });

      toast({
        title: isConnected ? "Conectado" : "Desconectado",
        description: isConnected 
          ? `WhatsApp conectado: ${result?.data?.instance?.phoneNumber || ""}` 
          : "WhatsApp não está conectado",
        variant: isConnected ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao verificar",
        description: error.message || "Não foi possível verificar a conexão.",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  const handleGenerateQRCode = async () => {
    if (!config) return;
    
    setGeneratingQR(true);

    try {
      // First try to get instance, if not exists, create it
      const { data: checkResult, error: checkError } = await supabase.functions.invoke('evolution-api', {
        body: { clinicId, action: 'fetchInstances' },
      });

      if (checkError) throw checkError;
      
      const instances = checkResult?.data;
      
      if (!instances || instances.length === 0) {
        // Create instance
        const { data: createResult, error: createError } = await supabase.functions.invoke('evolution-api', {
          body: { clinicId, action: 'create' },
        });
        
        if (createError) throw createError;
        if (!createResult?.success) {
          throw new Error(createResult?.error || 'Erro ao criar instância');
        }
      }

      // Get QR Code
      const { data: qrResult, error: qrError } = await supabase.functions.invoke('evolution-api', {
        body: { clinicId, action: 'connect' },
      });
      
      if (qrError) throw qrError;
      if (!qrResult?.success) {
        throw new Error(qrResult?.error || 'Erro ao gerar QR Code');
      }
      
      const qrData = qrResult?.data;
      
      if (qrData?.base64) {
        await supabase
          .from("evolution_configs")
          .update({ qr_code: qrData.base64 })
          .eq("id", config.id);

        setConfig({
          ...config,
          qr_code: qrData.base64,
        });

        toast({
          title: "QR Code gerado",
          description: "Escaneie o QR Code com seu WhatsApp.",
        });
      } else {
        toast({
          title: "QR Code não disponível",
          description: "O WhatsApp pode já estar conectado. Verifique o status.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao gerar QR Code",
        description: error.message || "Verifique as configurações da API.",
        variant: "destructive",
      });
    } finally {
      setGeneratingQR(false);
    }
  };

  const handleDisconnect = async () => {
    if (!config) return;
    
    setChecking(true);

    try {
      const { data: result, error } = await supabase.functions.invoke('evolution-api', {
        body: { clinicId, action: 'logout' },
      });

      if (error) throw error;
      if (!result?.success) {
        throw new Error(result?.error || 'Erro ao desconectar');
      }

      await supabase
        .from("evolution_configs")
        .update({
          is_connected: false,
          connected_at: null,
          phone_number: null,
          qr_code: null,
        })
        .eq("id", config.id);

      setConfig({
        ...config,
        is_connected: false,
        connected_at: null,
        phone_number: null,
        qr_code: null,
      });

      toast({
        title: "Desconectado",
        description: "WhatsApp desconectado com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao desconectar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  const handleToggleDirectReply = async () => {
    if (!config) return;

    const newValue = !config.direct_reply_enabled;
    
    try {
      // If enabling, set up webhook first
      if (newValue) {
        setSettingWebhook(true);
        
        const { data: result, error } = await supabase.functions.invoke('evolution-api', {
          body: { clinicId, action: 'setWebhook' },
        });

        if (error) throw error;
        if (!result?.success) {
          throw new Error(result?.error || 'Erro ao configurar webhook');
        }

        toast({
          title: "Webhook configurado",
          description: "O webhook foi configurado com sucesso na Evolution API.",
        });
      }

      // Update direct_reply_enabled in database
      const { error: updateError } = await supabase
        .from("evolution_configs")
        .update({ direct_reply_enabled: newValue })
        .eq("id", config.id);

      if (updateError) throw updateError;

      setConfig({
        ...config,
        direct_reply_enabled: newValue,
      });

      toast({
        title: newValue ? "Confirmação direta ativada" : "Confirmação direta desativada",
        description: newValue 
          ? "Pacientes podem responder SIM ou NÃO diretamente no WhatsApp." 
          : "Os lembretes voltarão a incluir o link de confirmação.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao alterar configuração",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSettingWebhook(false);
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
              <MessageSquare className="h-5 w-5 text-success" />
              Integração WhatsApp (Evolution API)
            </CardTitle>
            <CardDescription>
              Configure sua própria instância da Evolution API para enviar mensagens automáticas
            </CardDescription>
          </div>
          {config && (
            <Badge variant={config.is_connected ? "default" : "secondary"}>
              {config.is_connected ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Conectado
                </>
              ) : (
                <>
                  <X className="h-3 w-3 mr-1" />
                  Desconectado
                </>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration Form */}
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="api_url">URL da API</Label>
            <Input
              id="api_url"
              placeholder="https://sua-evolution-api.com"
              value={form.api_url}
              onChange={(e) => setForm({ ...form, api_url: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="api_key">API Key</Label>
            <Input
              id="api_key"
              type="password"
              placeholder="Sua chave de API"
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="instance_name">Nome da Instância</Label>
            <Input
              id="instance_name"
              placeholder="minha-clinica"
              value={form.instance_name}
              onChange={(e) => setForm({ ...form, instance_name: e.target.value })}
            />
          </div>
          
          <Button onClick={handleSaveConfig} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Configuração
          </Button>
        </div>

        {/* Connection Actions */}
        {config && (
          <>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Conexão WhatsApp</h4>
              
              {config.is_connected ? (
                <div className="space-y-4">
                  <div className="p-4 bg-success/10 rounded-lg">
                    <p className="text-sm font-medium text-success">WhatsApp Conectado</p>
                    {config.phone_number && (
                      <p className="text-sm text-muted-foreground">Número: {config.phone_number}</p>
                    )}
                    {config.connected_at && (
                      <p className="text-xs text-muted-foreground">
                        Conectado em: {new Date(config.connected_at).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleCheckConnection} disabled={checking}>
                      {checking ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Verificar Status
                    </Button>
                    <Button variant="destructive" onClick={handleDisconnect} disabled={checking}>
                      <Unplug className="h-4 w-4 mr-2" />
                      Desconectar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {config.qr_code ? (
                    <div className="flex flex-col items-center p-4 border rounded-lg bg-background">
                      <p className="text-sm mb-3 text-muted-foreground">
                        Escaneie o QR Code com seu WhatsApp
                      </p>
                      <img 
                        src={config.qr_code} 
                        alt="QR Code" 
                        className="w-64 h-64 border rounded"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Após escanear, clique em "Verificar Status"
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <QrCode className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Gere um QR Code para conectar seu WhatsApp
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button onClick={handleGenerateQRCode} disabled={generatingQR}>
                      {generatingQR ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <QrCode className="h-4 w-4 mr-2" />
                      )}
                      {config.qr_code ? "Gerar Novo QR Code" : "Gerar QR Code"}
                    </Button>
                    <Button variant="outline" onClick={handleCheckConnection} disabled={checking}>
                      {checking ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plug className="h-4 w-4 mr-2" />
                      )}
                      Verificar Status
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Direct Reply Configuration - Only show when connected */}
            {config.is_connected && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Webhook className="h-4 w-4" />
                  Confirmação por Resposta Direta
                </h4>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Ativar confirmação via WhatsApp</p>
                      <p className="text-xs text-muted-foreground">
                        Pacientes podem responder SIM ou NÃO diretamente no WhatsApp para confirmar ou cancelar consultas.
                      </p>
                    </div>
                    <Switch
                      checked={config.direct_reply_enabled}
                      onCheckedChange={handleToggleDirectReply}
                      disabled={settingWebhook}
                    />
                  </div>

                  {config.direct_reply_enabled && (
                    <div className="p-4 bg-success/10 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-success">
                        <Check className="h-4 w-4" />
                        <span className="text-sm font-medium">Confirmação direta ativada</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Os lembretes incluirão instruções para o paciente responder SIM ou NÃO. 
                        O sistema atualizará automaticamente o status da consulta.
                      </p>
                      {config.webhook_url && (
                        <p className="text-xs text-muted-foreground mt-2">
                          <strong>Webhook URL:</strong> {config.webhook_url}
                        </p>
                      )}
                    </div>
                  )}

                  {!config.direct_reply_enabled && (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        Quando desativado, os lembretes incluirão um link para confirmação via página web.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
