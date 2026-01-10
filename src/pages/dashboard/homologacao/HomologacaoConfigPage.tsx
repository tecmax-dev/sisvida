import { useState, useEffect } from "react";
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
  Clock,
  Building2,
  Phone
} from "lucide-react";

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
  
  const [formData, setFormData] = useState<Partial<HomologacaoSettings>>({
    display_name: "",
    manager_whatsapp: "",
    cancellation_deadline_hours: 24,
    allow_cancellation: true,
    require_confirmation: true,
    institutional_text: "",
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Configure o módulo de homologação</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Configurações Gerais
            </CardTitle>
            <CardDescription>
              Informações básicas do módulo de homologação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="display_name">Nome de Exibição</Label>
                <Input
                  id="display_name"
                  value={formData.display_name || ""}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="Ex: Central de Homologações"
                />
                <p className="text-xs text-muted-foreground">
                  Nome exibido na página pública de agendamento
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager_whatsapp">WhatsApp do Gestor</Label>
                <Input
                  id="manager_whatsapp"
                  value={formData.manager_whatsapp || ""}
                  onChange={(e) => setFormData({ ...formData, manager_whatsapp: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
                <p className="text-xs text-muted-foreground">
                  Recebe notificações de novos agendamentos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scheduling Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Prazos e Cancelamento
            </CardTitle>
            <CardDescription>
              Configure os prazos de cancelamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cancellation_deadline">Prazo de Cancelamento (horas)</Label>
                <Input
                  id="cancellation_deadline"
                  type="number"
                  min={1}
                  value={formData.cancellation_deadline_hours || 24}
                  onChange={(e) => setFormData({ ...formData, cancellation_deadline_hours: parseInt(e.target.value) || 24 })}
                />
                <p className="text-xs text-muted-foreground">
                  Antecedência mínima para cancelar sem penalidade
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Permitir Cancelamento</Label>
                <p className="text-sm text-muted-foreground">
                  Permite que empresas cancelem agendamentos
                </p>
              </div>
              <Switch
                checked={formData.allow_cancellation ?? true}
                onCheckedChange={(checked) => setFormData({ ...formData, allow_cancellation: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Exigir Confirmação</Label>
                <p className="text-sm text-muted-foreground">
                  Exige que o agendamento seja confirmado antes
                </p>
              </div>
              <Switch
                checked={formData.require_confirmation ?? true}
                onCheckedChange={(checked) => setFormData({ ...formData, require_confirmation: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Contato Público
            </CardTitle>
            <CardDescription>
              Informações de contato exibidas publicamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="public_whatsapp">WhatsApp Público</Label>
              <Input
                id="public_whatsapp"
                value={formData.public_whatsapp || ""}
                onChange={(e) => setFormData({ ...formData, public_whatsapp: e.target.value })}
                placeholder="(00) 00000-0000"
              />
              <p className="text-xs text-muted-foreground">
                Número exibido na página pública para contato
              </p>
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
              <p className="text-xs text-muted-foreground">
                Texto exibido na página pública com orientações
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </form>
    </div>
  );
}
