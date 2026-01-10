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
import { Separator } from "@/components/ui/separator";
import { 
  Settings, 
  Save,
  Clock,
  MessageSquare,
  Globe,
  Bell,
  Building2
} from "lucide-react";

interface HomologacaoSettings {
  id: string;
  clinic_id: string;
  display_name: string | null;
  manager_whatsapp: string | null;
  cancellation_deadline_hours: number;
  allow_cancellation: boolean;
  require_confirmation: boolean;
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
        reminder_hours: settings.reminder_hours || 24,
        is_public_booking_enabled: settings.is_public_booking_enabled || false,
        public_booking_instructions: settings.public_booking_instructions || "",
        confirmation_message: settings.confirmation_message || "",
        reminder_message: settings.reminder_message || "",
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
              Prazos e Horários
            </CardTitle>
            <CardDescription>
              Configure os prazos de cancelamento e lembretes
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
              <div className="space-y-2">
                <Label htmlFor="reminder_hours">Antecedência do Lembrete (horas)</Label>
                <Input
                  id="reminder_hours"
                  type="number"
                  min={1}
                  value={formData.reminder_hours || 24}
                  onChange={(e) => setFormData({ ...formData, reminder_hours: parseInt(e.target.value) || 24 })}
                />
                <p className="text-xs text-muted-foreground">
                  Horas antes do agendamento para enviar lembrete
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Public Booking Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Agendamento Público
            </CardTitle>
            <CardDescription>
              Configure a página pública de agendamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Habilitar Agendamento Público</Label>
                <p className="text-sm text-muted-foreground">
                  Permite que empresas agendem homologações online
                </p>
              </div>
              <Switch
                checked={formData.is_public_booking_enabled || false}
                onCheckedChange={(checked) => setFormData({ ...formData, is_public_booking_enabled: checked })}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="public_instructions">Instruções de Agendamento</Label>
              <Textarea
                id="public_instructions"
                value={formData.public_booking_instructions || ""}
                onChange={(e) => setFormData({ ...formData, public_booking_instructions: e.target.value })}
                placeholder="Instruções exibidas na página de agendamento..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Texto exibido na página pública com orientações para o agendamento
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Message Templates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Mensagens Automáticas
            </CardTitle>
            <CardDescription>
              Configure as mensagens enviadas automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirmation_message">Mensagem de Confirmação</Label>
              <Textarea
                id="confirmation_message"
                value={formData.confirmation_message || ""}
                onChange={(e) => setFormData({ ...formData, confirmation_message: e.target.value })}
                placeholder="Olá {nome}, seu agendamento foi confirmado para o dia {data} às {hora}..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Variáveis: {"{nome}"}, {"{data}"}, {"{hora}"}, {"{empresa}"}, {"{servico}"}
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="reminder_message">Mensagem de Lembrete</Label>
              <Textarea
                id="reminder_message"
                value={formData.reminder_message || ""}
                onChange={(e) => setFormData({ ...formData, reminder_message: e.target.value })}
                placeholder="Olá {nome}, lembramos que você tem um agendamento amanhã às {hora}..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Enviada automaticamente conforme prazo configurado
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
