import { useState, useEffect, Suspense, lazy } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { 
  Save,
  Link2,
  Palette,
  MessageCircle,
  Settings,
  Copy,
  Check
} from "lucide-react";

// Lazy loading após todos os imports estáticos
const HolidayImportSection = lazy(() => import("@/components/homologacao/HolidayImportSection"));

interface HomologacaoSettings {
  id: string;
  clinic_id: string;
  display_name: string | null;
  manager_whatsapp: string | null;
  cancellation_deadline_hours: number | null;
  allow_cancellation: boolean | null;
  require_confirmation: boolean | null;
  institutional_text: string | null;
  logo_url: string | null;
  public_whatsapp: string | null;
}

export default function HomologacaoConfigPage() {
  const { currentClinic } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  
  const [formData, setFormData] = useState<Partial<HomologacaoSettings>>({
    display_name: "",
    manager_whatsapp: "",
    cancellation_deadline_hours: 24,
    allow_cancellation: true,
    require_confirmation: true,
    institutional_text: "",
    logo_url: "",
    public_whatsapp: "",
  });

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["homologacao-settings", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return null;
      const { data, error } = await supabase
        .from("homologacao_settings")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as HomologacaoSettings | null;
    },
    enabled: !!currentClinic?.id,
  });

  // Update form when settings are loaded
  useEffect(() => {
    if (settings) {
      setFormData({
        display_name: settings.display_name || "",
        manager_whatsapp: settings.manager_whatsapp || "",
        cancellation_deadline_hours: settings.cancellation_deadline_hours || 24,
        allow_cancellation: settings.allow_cancellation ?? true,
        require_confirmation: settings.require_confirmation ?? true,
        institutional_text: settings.institutional_text || "",
        logo_url: settings.logo_url || "",
        public_whatsapp: settings.public_whatsapp || "",
      });
    }
  }, [settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (settings?.id) {
        // Update existing
        const { error } = await supabase
          .from("homologacao_settings")
          .update(data)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from("homologacao_settings")
          .insert({
            ...data,
            clinic_id: currentClinic?.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homologacao-settings"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar configurações: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  // Generate public link
  const publicLink = currentClinic?.slug 
    ? `${window.location.origin}/homologacao/${currentClinic.slug}`
    : "";

  const copyLink = async () => {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações de Homologação</h1>
          <p className="text-muted-foreground">Configure a página pública e notificações do módulo</p>
        </div>
        <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Public Link */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Link Público de Agendamento
            </CardTitle>
            <CardDescription>
              Compartilhe este link para empresas agendarem homologações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input 
                value={publicLink} 
                readOnly 
                className="bg-muted font-mono text-sm"
              />
              <Button variant="outline" onClick={copyLink}>
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Visual Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Identidade Visual
            </CardTitle>
            <CardDescription>
              Personalize a aparência da página pública
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">Nome de Exibição</Label>
              <Input
                id="display_name"
                value={formData.display_name || ""}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="Ex: Central de Homologações"
              />
              <p className="text-xs text-muted-foreground">
                Se vazio, será usado o nome padrão da clínica
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo_url">URL do Logo</Label>
              <Input
                id="logo_url"
                value={formData.logo_url || ""}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                placeholder="https://exemplo.com/logo.png"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="institutional_text">Texto Institucional</Label>
              <Textarea
                id="institutional_text"
                value={formData.institutional_text || ""}
                onChange={(e) => setFormData({ ...formData, institutional_text: e.target.value })}
                placeholder="Texto com instruções ou informações sobre a homologação..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact and Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Contato e Notificações
            </CardTitle>
            <CardDescription>
              Configure os números de WhatsApp para notificações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manager_whatsapp">WhatsApp do Gestor</Label>
                <Input
                  id="manager_whatsapp"
                  value={formData.manager_whatsapp || ""}
                  onChange={(e) => setFormData({ ...formData, manager_whatsapp: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
                <p className="text-xs text-muted-foreground">
                  Receberá notificações de novos agendamentos
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="public_whatsapp">WhatsApp para Contato</Label>
                <Input
                  id="public_whatsapp"
                  value={formData.public_whatsapp || ""}
                  onChange={(e) => setFormData({ ...formData, public_whatsapp: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
                <p className="text-xs text-muted-foreground">
                  Exibido na página pública para contato
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Behavior */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Comportamento
            </CardTitle>
            <CardDescription>
              Configure o funcionamento dos agendamentos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Exigir Confirmação</Label>
                <p className="text-sm text-muted-foreground">
                  Novos agendamentos precisam ser confirmados
                </p>
              </div>
              <Switch
                checked={formData.require_confirmation ?? true}
                onCheckedChange={(checked) => setFormData({ ...formData, require_confirmation: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Permitir Cancelamento</Label>
                <p className="text-sm text-muted-foreground">
                  Empresas podem cancelar agendamentos
                </p>
              </div>
              <Switch
                checked={formData.allow_cancellation ?? true}
                onCheckedChange={(checked) => setFormData({ ...formData, allow_cancellation: checked })}
              />
            </div>

            <div className="space-y-2 pt-2">
              <Label htmlFor="cancellation_deadline">Prazo para Cancelamento (horas)</Label>
              <Input
                id="cancellation_deadline"
                type="number"
                min={1}
                className="max-w-[200px]"
                value={formData.cancellation_deadline_hours || 24}
                onChange={(e) => setFormData({ ...formData, cancellation_deadline_hours: parseInt(e.target.value) || 24 })}
              />
              <p className="text-xs text-muted-foreground">
                Cancelamentos devem ser feitos com pelo menos {formData.cancellation_deadline_hours || 24} horas de antecedência
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Holiday Import Section */}
        <Suspense fallback={<Skeleton className="h-64" />}>
          <HolidayImportSection />
        </Suspense>
      </div>
    </div>
  );
}
