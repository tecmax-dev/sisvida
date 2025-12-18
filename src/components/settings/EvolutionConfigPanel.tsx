import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const [config, setConfig] = useState<EvolutionConfig | null>(null);
  const [form, setForm] = useState({
    instance_name: "",
    api_url: "",
    api_key: "",
  });

  useEffect(() => {
    loadConfig();
  }, [clinicId]);

  const loadConfig = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from("evolution_configs")
      .select("*")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (data) {
      setConfig(data);
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
      const response = await fetch(`${config.api_url}/instance/connectionState/${config.instance_name}`, {
        headers: {
          "apikey": config.api_key,
        },
      });

      const data = await response.json();
      const isConnected = data?.instance?.state === "open";

      await supabase
        .from("evolution_configs")
        .update({
          is_connected: isConnected,
          connected_at: isConnected ? new Date().toISOString() : null,
          phone_number: data?.instance?.phoneNumber || null,
        })
        .eq("id", config.id);

      setConfig({
        ...config,
        is_connected: isConnected,
        connected_at: isConnected ? new Date().toISOString() : null,
        phone_number: data?.instance?.phoneNumber || null,
      });

      toast({
        title: isConnected ? "Conectado" : "Desconectado",
        description: isConnected 
          ? `WhatsApp conectado: ${data?.instance?.phoneNumber || ""}` 
          : "WhatsApp não está conectado",
        variant: isConnected ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao verificar",
        description: "Não foi possível verificar a conexão.",
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
      const checkResponse = await fetch(`${config.api_url}/instance/fetchInstances?instanceName=${config.instance_name}`, {
        headers: {
          "apikey": config.api_key,
        },
      });

      const instances = await checkResponse.json();
      
      if (!instances || instances.length === 0) {
        // Create instance
        await fetch(`${config.api_url}/instance/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": config.api_key,
          },
          body: JSON.stringify({
            instanceName: config.instance_name,
            qrcode: true,
          }),
        });
      }

      // Get QR Code
      const qrResponse = await fetch(`${config.api_url}/instance/connect/${config.instance_name}`, {
        headers: {
          "apikey": config.api_key,
        },
      });

      const qrData = await qrResponse.json();
      
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
        description: error.message,
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
      await fetch(`${config.api_url}/instance/logout/${config.instance_name}`, {
        method: "DELETE",
        headers: {
          "apikey": config.api_key,
        },
      });

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
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setChecking(false);
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
