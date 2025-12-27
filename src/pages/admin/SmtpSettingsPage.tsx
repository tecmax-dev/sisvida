import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { 
  Mail, 
  Server, 
  Key, 
  User, 
  Send, 
  Save, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  Zap,
  PartyPopper,
  MailCheck
} from "lucide-react";

interface SmtpSettings {
  id?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  encryption: string;
  is_active: boolean;
}

const defaultSettings: SmtpSettings = {
  host: "",
  port: 587,
  username: "",
  password: "",
  from_email: "",
  from_name: "Eclini",
  encryption: "tls",
  is_active: true,
};

const portOptions = [
  { value: "25", label: "25 (SMTP padrão)" },
  { value: "465", label: "465 (SSL)" },
  { value: "587", label: "587 (TLS - Recomendado)" },
  { value: "2525", label: "2525 (Alternativo)" },
];

const encryptionOptions = [
  { value: "tls", label: "TLS (Recomendado)" },
  { value: "ssl", label: "SSL" },
  { value: "none", label: "Nenhuma" },
];

export default function SmtpSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SmtpSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [hasExistingSettings, setHasExistingSettings] = useState(false);
  
  // Resend test states
  const [resendTestEmail, setResendTestEmail] = useState("");
  const [resendTestName, setResendTestName] = useState("");
  const [resendTestType, setResendTestType] = useState<"welcome" | "confirmation">("welcome");
  const [isTestingResend, setIsTestingResend] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("smtp_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
          host: data.host,
          port: data.port,
          username: data.username,
          password: data.password,
          from_email: data.from_email,
          from_name: data.from_name,
          encryption: data.encryption,
          is_active: data.is_active,
        });
        setHasExistingSettings(true);
      }
    } catch (error: any) {
      console.error("Error fetching SMTP settings:", error);
      toast({
        title: "Erro ao carregar configurações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.host || !settings.username || !settings.password || !settings.from_email) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const settingsData = {
        host: settings.host,
        port: settings.port,
        username: settings.username,
        password: settings.password,
        from_email: settings.from_email,
        from_name: settings.from_name,
        encryption: settings.encryption,
        is_active: settings.is_active,
        created_by: user?.id,
      };

      let error;
      if (hasExistingSettings && settings.id) {
        const result = await supabase
          .from("smtp_settings")
          .update(settingsData)
          .eq("id", settings.id);
        error = result.error;
      } else {
        const result = await supabase
          .from("smtp_settings")
          .insert(settingsData)
          .select()
          .single();
        error = result.error;
        if (result.data) {
          setSettings(prev => ({ ...prev, id: result.data.id }));
          setHasExistingSettings(true);
        }
      }

      if (error) throw error;

      toast({
        title: "Configurações salvas",
        description: "As configurações SMTP foram salvas com sucesso.",
      });
    } catch (error: any) {
      console.error("Error saving SMTP settings:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      toast({
        title: "Email de teste",
        description: "Informe um email para receber o teste.",
        variant: "destructive",
      });
      return;
    }

    if (!settings.host || !settings.username || !settings.password || !settings.from_email) {
      toast({
        title: "Configurações incompletas",
        description: "Preencha todas as configurações antes de testar.",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);

    try {
      const { data, error } = await supabase.functions.invoke("test-smtp-connection", {
        body: {
          ...settings,
          test_email: testEmail,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Teste bem-sucedido!",
          description: `Email de teste enviado para ${testEmail}`,
        });
      } else {
        throw new Error(data?.error || "Falha no teste");
      }
    } catch (error: any) {
      console.error("Error testing SMTP:", error);
      toast({
        title: "Erro no teste",
        description: error.message || "Não foi possível enviar o email de teste.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestResend = async () => {
    if (!resendTestEmail || !resendTestName) {
      toast({
        title: "Campos obrigatórios",
        description: "Informe email e nome para o teste.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingResend(true);

    try {
      const functionName = resendTestType === "welcome" ? "send-welcome-email" : "send-confirmation-email";
      
      const body = resendTestType === "welcome" 
        ? { userEmail: resendTestEmail, userName: resendTestName, trialDays: 14 }
        : { userEmail: resendTestEmail, userName: resendTestName, confirmationToken: "test-token-" + Date.now() };

      const { data, error } = await supabase.functions.invoke(functionName, { body });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Email enviado com sucesso!",
          description: `Email de ${resendTestType === "welcome" ? "boas-vindas" : "confirmação"} enviado para ${resendTestEmail}`,
        });
      } else {
        throw new Error(data?.error || data?.details || "Falha no envio");
      }
    } catch (error: any) {
      console.error("Error testing Resend:", error);
      toast({
        title: "Erro no envio",
        description: error.message || "Não foi possível enviar o email de teste.",
        variant: "destructive",
      });
    } finally {
      setIsTestingResend(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Mail className="h-6 w-6" />
          Configurações de Email
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure SMTP ou teste o envio via Resend API
        </p>
      </div>

      <Tabs defaultValue="resend" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="resend" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Resend API
          </TabsTrigger>
          <TabsTrigger value="smtp" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            SMTP (Legado)
          </TabsTrigger>
        </TabsList>

        {/* Resend API Tab */}
        <TabsContent value="resend" className="space-y-6">
          <Alert className="bg-primary/5 border-primary/20">
            <Zap className="h-4 w-4 text-primary" />
            <AlertDescription>
              O sistema agora usa <strong>Resend API</strong> para envio de emails, garantindo melhor 
              entregabilidade e encoding correto de caracteres especiais.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="h-5 w-5" />
                Testar Envio de Email
              </CardTitle>
              <CardDescription>
                Envie um email de teste para verificar se o Resend está funcionando corretamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="resend-email">Email de destino *</Label>
                  <Input
                    id="resend-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={resendTestEmail}
                    onChange={(e) => setResendTestEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resend-name">Nome do destinatário *</Label>
                  <Input
                    id="resend-name"
                    placeholder="João Silva"
                    value={resendTestName}
                    onChange={(e) => setResendTestName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de email</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={resendTestType === "welcome" ? "default" : "outline"}
                    onClick={() => setResendTestType("welcome")}
                    className="flex-1"
                  >
                    <PartyPopper className="mr-2 h-4 w-4" />
                    Boas-vindas
                  </Button>
                  <Button
                    type="button"
                    variant={resendTestType === "confirmation" ? "default" : "outline"}
                    onClick={() => setResendTestType("confirmation")}
                    className="flex-1"
                  >
                    <MailCheck className="mr-2 h-4 w-4" />
                    Confirmação
                  </Button>
                </div>
              </div>

              <Button
                onClick={handleTestResend}
                disabled={isTestingResend || !resendTestEmail || !resendTestName}
                className="w-full"
                size="lg"
              >
                {isTestingResend ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar Email de Teste
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMTP Tab */}
        <TabsContent value="smtp" className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              As configurações SMTP são mantidas como backup. O sistema agora prioriza o envio via Resend API.
            </AlertDescription>
          </Alert>

      <div className="grid gap-6">
        {/* Status Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {settings.is_active && hasExistingSettings ? (
                  <>
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">SMTP Configurado</p>
                      <p className="text-sm text-muted-foreground">{settings.host}:{settings.port}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">SMTP Não Configurado</p>
                      <p className="text-sm text-muted-foreground">Configure para habilitar envio de emails</p>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="is-active" className="text-sm">Ativo</Label>
                <Switch
                  id="is-active"
                  checked={settings.is_active}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, is_active: checked }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Server Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-5 w-5" />
              Servidor SMTP
            </CardTitle>
            <CardDescription>
              Configurações de conexão com o servidor de email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="host">Host SMTP *</Label>
                <Input
                  id="host"
                  placeholder="smtp.gmail.com"
                  value={settings.host}
                  onChange={(e) => setSettings(prev => ({ ...prev, host: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Porta *</Label>
                <Select
                  value={String(settings.port)}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, port: parseInt(value) }))}
                >
                  <SelectTrigger id="port">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {portOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="encryption">Criptografia</Label>
              <Select
                value={settings.encryption}
                onValueChange={(value) => setSettings(prev => ({ ...prev, encryption: value }))}
              >
                <SelectTrigger id="encryption">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {encryptionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5" />
              Autenticação
            </CardTitle>
            <CardDescription>
              Credenciais para autenticação no servidor SMTP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuário / Email *</Label>
                <Input
                  id="username"
                  placeholder="usuario@seudominio.com"
                  value={settings.username}
                  onChange={(e) => setSettings(prev => ({ ...prev, username: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={settings.password}
                    onChange={(e) => setSettings(prev => ({ ...prev, password: e.target.value }))}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                A senha é armazenada de forma segura no banco de dados e usada apenas para autenticação SMTP.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Sender Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Remetente
            </CardTitle>
            <CardDescription>
              Informações que aparecerão como remetente dos emails
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from_email">Email do Remetente *</Label>
                <Input
                  id="from_email"
                  type="email"
                  placeholder="noreply@suaclinica.com"
                  value={settings.from_email}
                  onChange={(e) => setSettings(prev => ({ ...prev, from_email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from_name">Nome do Remetente</Label>
                <Input
                  id="from_name"
                  placeholder="Eclini"
                  value={settings.from_name}
                  onChange={(e) => setSettings(prev => ({ ...prev, from_name: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Email */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="h-5 w-5" />
              Testar Configuração
            </CardTitle>
            <CardDescription>
              Envie um email de teste para verificar se as configurações estão corretas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="email"
                placeholder="seu@email.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleTest}
                disabled={isTesting || !testEmail}
                variant="outline"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar Teste
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="lg"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
