import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Save, Globe, Wifi, CheckCircle, XCircle, Scale, MessageSquare, Copy } from "lucide-react";
import { UnionPlanProfessionalsConfig } from "@/components/admin/UnionPlanProfessionalsConfig";

interface GlobalConfig {
  id?: string;
  evolution_api_url: string;
  evolution_api_key: string;
  evolution_instance: string;
  meta_api_active: "v1" | "v2";
}

export default function GlobalConfigPage() {
  const [config, setConfig] = useState<GlobalConfig>({
    evolution_api_url: "",
    evolution_api_key: "",
    evolution_instance: "",
    meta_api_active: "v1",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "error">("idle");
  const [copying, setCopying] = useState(false);
  const [copyResult, setCopyResult] = useState<any>(null);

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
          meta_api_active: ((data as any).meta_api_active as "v1" | "v2") || "v1",
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
            meta_api_active: config.meta_api_active,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("global_config")
          .insert({
            evolution_api_url: config.evolution_api_url,
            evolution_api_key: config.evolution_api_key,
            evolution_instance: config.evolution_instance,
            meta_api_active: config.meta_api_active,
          } as any);

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

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="integrations" className="gap-2">
            <Globe className="h-4 w-4" />
            Integrações
          </TabsTrigger>
          <TabsTrigger value="meta" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Meta WhatsApp
          </TabsTrigger>
          <TabsTrigger value="union-plans" className="gap-2">
            <Scale className="h-4 w-4" />
            Planos Sindicato
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations">
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
        </TabsContent>

        <TabsContent value="union-plans">
          <UnionPlanProfessionalsConfig />
        </TabsContent>

        <TabsContent value="meta">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Meta WhatsApp Cloud API
              </CardTitle>
              <CardDescription>
                Selecione qual conta Meta está ativa para envios (toggle global). As credenciais
                são armazenadas como secrets (META_WHATSAPP_TOKEN / _V2).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="meta_api_active">API ativa</Label>
                <select
                  id="meta_api_active"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={config.meta_api_active}
                  onChange={(e) =>
                    setConfig({ ...config, meta_api_active: e.target.value as "v1" | "v2" })
                  }
                >
                  <option value="v1">V1 — Conta atual (META_WHATSAPP_TOKEN)</option>
                  <option value="v2">V2 — Nova conta (META_WHATSAPP_TOKEN_V2)</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Lembrete: o webhook da Meta precisa apontar para o mesmo endpoint nas duas
                  WABAs para receber mensagens das duas contas.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
              </div>

              <div className="border-t pt-4 space-y-3">
                <h3 className="font-medium">Copiar templates V1 → V2</h3>
                <p className="text-sm text-muted-foreground">
                  Replica todos os templates aprovados da WABA V1 na WABA V2. Templates já
                  existentes no destino são ignorados. Após criar, aguarde aprovação da Meta.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={copying}
                    onClick={async () => {
                      setCopying(true);
                      setCopyResult(null);
                      try {
                        const { data, error } = await supabase.functions.invoke("meta-copy-templates", {
                          body: { source: "v1", target: "v2", dry_run: true },
                        });
                        if (error) throw error;
                        setCopyResult(data);
                        toast.success(`Dry-run: ${data?.summary?.total_source ?? 0} templates encontrados`);
                      } catch (e: any) {
                        toast.error("Erro: " + e.message);
                      } finally {
                        setCopying(false);
                      }
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" /> Dry-run
                  </Button>
                  <Button
                    disabled={copying}
                    onClick={async () => {
                      if (!confirm("Confirmar cópia de TODOS os templates V1 → V2?")) return;
                      setCopying(true);
                      setCopyResult(null);
                      try {
                        const { data, error } = await supabase.functions.invoke("meta-copy-templates", {
                          body: { source: "v1", target: "v2" },
                        });
                        if (error) throw error;
                        setCopyResult(data);
                        toast.success(
                          `Cópia concluída: ${data?.summary?.created ?? 0} criados, ${data?.summary?.already_exists ?? 0} existentes, ${data?.summary?.errors ?? 0} erros`,
                        );
                      } catch (e: any) {
                        toast.error("Erro: " + e.message);
                      } finally {
                        setCopying(false);
                      }
                    }}
                  >
                    {copying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Copy className="h-4 w-4 mr-2" />}
                    Copiar agora
                  </Button>
                </div>
                {copyResult && (
                  <pre className="text-xs bg-muted p-3 rounded-md max-h-96 overflow-auto">
                    {JSON.stringify(copyResult.summary ?? copyResult, null, 2)}
                  </pre>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}