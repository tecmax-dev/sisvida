import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Save, Globe, Wifi, CheckCircle, XCircle } from "lucide-react";

interface GlobalConfig {
  id?: string;
  evolution_api_url: string;
  evolution_api_key: string;
  evolution_instance: string;
}

export default function GlobalConfigPage() {
  const [config, setConfig] = useState<GlobalConfig>({
    evolution_api_url: "",
    evolution_api_key: "",
    evolution_instance: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "error">("idle");

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("global_config")
        .select("*")
        .maybeSingle();

      if (error) {
        console.error("Error loading global_config:", error);
        toast.error("Erro ao carregar configurações: " + error.message);
        setLoading(false);
        return;
      }

      if (data) {
        setConfig({
          id: data.id,
          evolution_api_url: data.evolution_api_url || "",
          evolution_api_key: data.evolution_api_key || "",
          evolution_instance: data.evolution_instance || "",
        });
      }
    } catch (error: any) {
      console.error("Error loading config:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (config.id) {
        const { error } = await supabase
          .from("global_config")
          .update({
            evolution_api_url: config.evolution_api_url,
            evolution_api_key: config.evolution_api_key,
            evolution_instance: config.evolution_instance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("global_config")
          .insert({
            evolution_api_url: config.evolution_api_url,
            evolution_api_key: config.evolution_api_key,
            evolution_instance: config.evolution_instance,
          });

        if (error) throw error;
      }

      toast.success("Configurações salvas com sucesso!");
      loadConfig();
    } catch (error: any) {
      console.error("Error saving config:", error);
      toast.error("Erro ao salvar configurações: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config.evolution_api_url || !config.evolution_api_key || !config.evolution_instance) {
      toast.error("Preencha todos os campos antes de testar");
      return;
    }

    setTesting(true);
    setConnectionStatus("idle");
    
    try {
      const { data, error } = await supabase.functions.invoke("check-evolution-status", {
        body: {
          api_url: config.evolution_api_url,
          api_key: config.evolution_api_key,
          instance_name: config.evolution_instance,
        },
      });

      if (error) throw error;

      if (data?.connected) {
        setConnectionStatus("connected");
        toast.success("Conexão estabelecida com sucesso!");
      } else {
        setConnectionStatus("error");
        toast.error(data?.error || "Falha ao conectar com a Evolution API");
      }
    } catch (error: any) {
      console.error("Error testing connection:", error);
      setConnectionStatus("error");
      toast.error("Erro ao testar conexão: " + (error.message || "Erro desconhecido"));
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuração Global</h1>
        <p className="text-muted-foreground">
          Configure as integrações globais do sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Evolution API
          </CardTitle>
          <CardDescription>
            Configure a URL e chave da Evolution API para envio de mensagens WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="evolution_api_url">URL da API</Label>
            <Input
              id="evolution_api_url"
              value={config.evolution_api_url}
              onChange={(e) =>
                setConfig({ ...config, evolution_api_url: e.target.value })
              }
              placeholder="https://api.evolution.com.br"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="evolution_api_key">Chave da API (API Key)</Label>
            <Input
              id="evolution_api_key"
              type="password"
              value={config.evolution_api_key}
              onChange={(e) =>
                setConfig({ ...config, evolution_api_key: e.target.value })
              }
              placeholder="Sua chave de API"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="evolution_instance">Nome da Instância</Label>
            <Input
              id="evolution_instance"
              value={config.evolution_instance}
              onChange={(e) =>
                setConfig({ ...config, evolution_instance: e.target.value })
              }
              placeholder="ex: eclini"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Configurações
            </Button>

            <Button 
              variant="outline" 
              onClick={handleTestConnection} 
              disabled={testing || !config.evolution_api_url || !config.evolution_api_key || !config.evolution_instance}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : connectionStatus === "connected" ? (
                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              ) : connectionStatus === "error" ? (
                <XCircle className="h-4 w-4 mr-2 text-red-500" />
              ) : (
                <Wifi className="h-4 w-4 mr-2" />
              )}
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}