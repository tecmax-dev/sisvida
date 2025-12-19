import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Bell, Clock, Globe, ShieldCheck } from "lucide-react";
import { EvolutionConfigPanel } from "@/components/settings/EvolutionConfigPanel";

export default function SettingsPage() {
  const { user, currentClinic } = useAuth();
  const { toast } = useToast();
  const [clinicName, setClinicName] = useState("Clínica Saúde Total");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState("24");
  const [enforceScheduleValidation, setEnforceScheduleValidation] = useState(true);
  const [loadingValidation, setLoadingValidation] = useState(false);

  // Load clinic settings
  useEffect(() => {
    const loadClinicSettings = async () => {
      if (!currentClinic?.id) return;
      
      const { data, error } = await supabase
        .from('clinics')
        .select('enforce_schedule_validation, name, reminder_enabled, reminder_hours')
        .eq('id', currentClinic.id)
        .single();
      
      if (!error && data) {
        setEnforceScheduleValidation(data.enforce_schedule_validation ?? true);
        setClinicName(data.name || "Clínica");
        setReminderEnabled(data.reminder_enabled ?? true);
        setReminderTime(String(data.reminder_hours || 24));
      }
    };
    
    loadClinicSettings();
  }, [currentClinic?.id]);

  const handleToggleScheduleValidation = async (enabled: boolean) => {
    if (!currentClinic?.id) return;
    
    setLoadingValidation(true);
    
    try {
      const { error } = await supabase
        .from('clinics')
        .update({ enforce_schedule_validation: enabled })
        .eq('id', currentClinic.id);
      
      if (error) throw error;
      
      setEnforceScheduleValidation(enabled);
      toast({
        title: enabled ? "Validação ativada" : "Validação desativada",
        description: enabled 
          ? "Agendamentos fora do horário do profissional serão bloqueados."
          : "Agendamentos serão permitidos em qualquer horário.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível atualizar a configuração.",
        variant: "destructive",
      });
    } finally {
      setLoadingValidation(false);
    }
  };

  const bookingPath = currentClinic?.slug ? `/agendar/${currentClinic.slug}` : "/agendar";
  const bookingLink = `${window.location.origin}${bookingPath}`;

  const handleSave = () => {
    toast({
      title: "Configurações salvas",
      description: "Suas alterações foram salvas com sucesso.",
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">
          Personalize as configurações da sua clínica
        </p>
      </div>

      {/* Clinic Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Dados da Clínica</CardTitle>
              <CardDescription>
                Informações básicas da sua clínica
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clinicName">Nome da Clínica</Label>
              <Input
                id="clinicName"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Lembretes WhatsApp</CardTitle>
              <CardDescription>
                Configure os lembretes automáticos
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Lembretes automáticos</p>
              <p className="text-sm text-muted-foreground">
                Enviar lembretes de consulta via WhatsApp
              </p>
            </div>
            <Switch
              checked={reminderEnabled}
              onCheckedChange={setReminderEnabled}
            />
          </div>
          
          {reminderEnabled && (
            <div className="space-y-2">
              <Label htmlFor="reminderTime">Tempo antes da consulta</Label>
              <select
                id="reminderTime"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
              >
                <option value="12">12 horas antes</option>
                <option value="24">24 horas antes</option>
                <option value="48">48 horas antes</option>
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Working Hours */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Horário de Funcionamento</CardTitle>
              <CardDescription>
                Defina os horários padrão da clínica
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="openTime">Abertura</Label>
              <Input id="openTime" type="time" defaultValue="08:00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closeTime">Fechamento</Label>
              <Input id="closeTime" type="time" defaultValue="18:00" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Validation */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Validação de Horários</CardTitle>
              <CardDescription>
                Controle de agendamentos fora do expediente
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Bloquear agendamentos fora do horário</p>
              <p className="text-sm text-muted-foreground">
                Quando ativado, impede agendamentos fora dos dias e horários configurados para cada profissional
              </p>
            </div>
            <Switch
              checked={enforceScheduleValidation}
              onCheckedChange={handleToggleScheduleValidation}
              disabled={loadingValidation}
            />
          </div>
          
          {enforceScheduleValidation && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                ⚠️ <strong>Atenção:</strong> Esta regra se aplica a todos os usuários, 
                incluindo profissionais, atendentes e administradores.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Online Booking */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Agendamento Online</CardTitle>
              <CardDescription>
                Link para agendamento de pacientes
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground mb-2">
              Compartilhe este link com seus pacientes
            </p>
            <div className="flex gap-2">
              <Input readOnly value={bookingLink} className="bg-background" />
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(bookingLink);
                    toast({
                      title: "Link copiado!",
                      description: "Agora é só colar e compartilhar com seus pacientes.",
                    });
                  } catch {
                    toast({
                      title: "Não foi possível copiar",
                      description: "Copie manualmente o link.",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Copiar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Integration */}
      {currentClinic && (
        <EvolutionConfigPanel clinicId={currentClinic.id} />
      )}

      <div className="flex justify-end">
        <Button variant="hero" onClick={handleSave}>
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
