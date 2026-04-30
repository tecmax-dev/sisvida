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
  api_token: string;
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
  const [form, setForm] = useState({
    api_token: "",
    instance_id: "",
  });

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
        setForm({
          api_token: data.api_token,
          instance_id: data.instance_id || "",
        });
      }
    } catch (error) {
      console.error("Error loading Zap Responder config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!form.api_token) {
      toast({
        title: "Campo obrigatório",
        description: "O Token da API é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (config) {
        const { error } = await supabase
          .from("zapresponder_configs")
          .update({
            api_token: form.api_token,
            instance_id: form.instance_id,
          })
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("zapresponder_configs")
          .insert({
            api_token: form.api_token,
            instance_id: form.instance_id,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;
        setConfig(data);
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
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="api_token">Token da API</Label>
            <Input
              id="api_token"
              type="password"
              placeholder="Cole seu token aqui"
              value={form.api_token}
              onChange={(e) => setForm({ ...form, api_token: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instance_id">ID da Instância (Opcional)</Label>
            <Input
              id="instance_id"
              placeholder="Ex: inst_123..."
              value={form.instance_id}
              onChange={(e) => setForm({ ...form, instance_id: e.target.value })}
            />
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

        <div className="flex justify-end pt-4">
          <Button onClick={handleSaveConfig} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
