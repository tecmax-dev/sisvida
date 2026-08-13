import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Save, Globe, Wifi, CheckCircle, XCircle, Scale, MessageSquare, Copy, Rocket, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UnionPlanProfessionalsConfig } from "@/components/admin/UnionPlanProfessionalsConfig";

interface GlobalConfig {
  id?: string;
  evolution_api_url: string;
  evolution_api_key: string;
  evolution_instance: string;
  meta_api_active: "v1" | "v2";
  trial_signup_enabled: boolean;
}

export default function GlobalConfigPage() {
  const [config, setConfig] = useState<GlobalConfig>({
    evolution_api_url: "",
    evolution_api_key: "",
    evolution_instance: "",
    meta_api_active: "v1",
    trial_signup_enabled: true,
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
          trial_signup_enabled:
            typeof (data as any).trial_signup_enabled === "boolean"
              ? (data as any).trial_signup_enabled
              : true,
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
            trial_signup_enabled: config.trial_signup_enabled,
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
            trial_signup_enabled: config.trial_signup_enabled,
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
          <TabsTrigger value="landing" className="gap-2">
            <Rocket className="h-4 w-4" />
            Landing Page
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Evolution API (LEGADO)
              </CardTitle>
              <CardDescription>
                A integração direta com a Evolution API está desativada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 opacity-50 grayscale pointer-events-none">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Este provedor é considerado LEGADO e não deve ser utilizado.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="evolution_api_url">URL da API</Label>
                  <Input id="evolution_api_url" value={config.evolution_api_url} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evolution_api_key">Chave da API</Label>
                  <Input id="evolution_api_key" type="password" value={config.evolution_api_key} readOnly />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="union-plans">
          <UnionPlanProfessionalsConfig />
        </TabsContent>

        <TabsContent value="landing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                Página principal (Prosinge SaaS)
              </CardTitle>
              <CardDescription>
                Controla elementos exibidos na landing pública do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <Label htmlFor="trial_signup_enabled" className="text-base font-semibold">
                    Botão "Teste gratuitamente"
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Quando desativado, o botão de criar conta teste é removido da página
                    principal (hero, seção de credibilidade e CTA de referência).
                  </p>
                </div>
                <Switch
                  id="trial_signup_enabled"
                  checked={config.trial_signup_enabled}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, trial_signup_enabled: checked })
                  }
                />
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meta">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Meta WhatsApp Cloud API
              </CardTitle>
              <CardDescription>
                A integração direta com a Meta via API Cloud está desativada. O sistema utiliza agora o ZapResponde como gateway oficial.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Esta configuração é LEGADA e não deve ser utilizada para novos envios.
                </AlertDescription>
              </Alert>
              <div className="space-y-2 opacity-50 pointer-events-none">
                <Label htmlFor="meta_api_active">API ativa (Bloqueado)</Label>
                <Input value={config.meta_api_active || "v1"} readOnly />
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