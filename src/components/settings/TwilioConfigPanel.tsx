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
  Check,
  X,
  ExternalLink,
} from "lucide-react";

interface TwilioConfig {
  id: string;
  clinic_id: string;
  account_sid: string;
  auth_token: string;
  phone_number: string;
  is_active: boolean;
  is_connected: boolean;
}

interface TwilioConfigPanelProps {
  clinicId: string;
}

export function TwilioConfigPanel({ clinicId }: TwilioConfigPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<TwilioConfig | null>(null);
  const [form, setForm] = useState({
    account_sid: "",
    auth_token: "",
    phone_number: "",
  });

  useEffect(() => {
    loadConfig();
  }, [clinicId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("twilio_configs")
        .select("*")
        .eq("clinic_id", clinicId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data);
        setForm({
          account_sid: data.account_sid || "",
          auth_token: data.auth_token || "",
          phone_number: data.phone_number || "",
        });
      }
    } catch (error: any) {
      console.error("Error loading Twilio config:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configuração do Twilio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!form.account_sid || !form.auth_token || !form.phone_number) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha Account SID, Auth Token e Número do WhatsApp",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const configData = {
        clinic_id: clinicId,
        account_sid: form.account_sid.trim(),
        auth_token: form.auth_token.trim(),
        phone_number: form.phone_number.trim(),
        is_active: true,
      };

      if (config?.id) {
        const { error } = await supabase
          .from("twilio_configs")
          .update(configData)
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("twilio_configs")
          .insert(configData);

        if (error) throw error;
      }

      toast({
        title: "Configuração salva",
        description: "Configuração do Twilio salva com sucesso",
      });

      await loadConfig();
    } catch (error: any) {
      console.error("Error saving Twilio config:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar configuração",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);

      const { data, error } = await supabase.functions.invoke("twilio-api", {
        body: { clinicId, action: "testConnection" },
      });

      if (error) throw error;

      if (data?.success) {
        // Update connection status
        await supabase
          .from("twilio_configs")
          .update({ is_connected: true })
          .eq("clinic_id", clinicId);

        toast({
          title: "Conexão bem-sucedida",
          description: "Twilio WhatsApp está configurado corretamente!",
        });
        
        await loadConfig();
      } else {
        throw new Error(data?.error || "Falha na conexão");
      }
    } catch (error: any) {
      console.error("Error testing Twilio connection:", error);
      
      await supabase
        .from("twilio_configs")
        .update({ is_connected: false })
        .eq("clinic_id", clinicId);

      toast({
        title: "Erro na conexão",
        description: error.message || "Não foi possível conectar ao Twilio",
        variant: "destructive",
      });
      
      await loadConfig();
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            <CardTitle>Twilio WhatsApp</CardTitle>
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
        <CardDescription>
          Configure a integração com Twilio para enviar mensagens WhatsApp com botões interativos.
          <a
            href="https://www.twilio.com/console"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 ml-2 text-primary hover:underline"
          >
            Console Twilio <ExternalLink className="h-3 w-3" />
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="account_sid">Account SID</Label>
            <Input
              id="account_sid"
              value={form.account_sid}
              onChange={(e) => setForm({ ...form, account_sid: e.target.value })}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
            <p className="text-xs text-muted-foreground">
              Encontre no painel do Twilio em Account Info
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth_token">Auth Token</Label>
            <Input
              id="auth_token"
              type="password"
              value={form.auth_token}
              onChange={(e) => setForm({ ...form, auth_token: e.target.value })}
              placeholder="Seu Auth Token"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone_number">Número WhatsApp</Label>
            <Input
              id="phone_number"
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              placeholder="whatsapp:+5511999999999"
            />
            <p className="text-xs text-muted-foreground">
              Formato: whatsapp:+5511999999999 (inclua o prefixo whatsapp:)
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button onClick={handleSaveConfig} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>

          {config && (
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Testar Conexão
            </Button>
          )}
        </div>

        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Sobre o Twilio WhatsApp</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Suporta botões interativos nativos</li>
            <li>• Requer aprovação de templates pela Meta</li>
            <li>• Custo por mensagem (~$0.005-0.08)</li>
            <li>• Ideal para grandes volumes de mensagens</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
