import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Bell, Clock, Globe, ShieldCheck, MapPin, ExternalLink, Lock, ImageIcon, Upload, Trash2, Users, Bot } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { EvolutionConfigPanel } from "@/components/settings/EvolutionConfigPanel";
import { TwilioConfigPanel } from "@/components/settings/TwilioConfigPanel";
import { WhatsAppProviderSelector } from "@/components/settings/WhatsAppProviderSelector";
import { ApiKeysPanel } from "@/components/settings/ApiKeysPanel";
import { WebhooksPanel } from "@/components/settings/WebhooksPanel";
import { MessageHistoryPanel } from "@/components/settings/MessageHistoryPanel";
import { AIAssistantChat } from "@/components/chat/AIAssistantChat";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { usePermissions } from "@/hooks/usePermissions";
import { useAutoSave, AutoSaveStatus } from "@/hooks/useAutoSave";
import { AutoSaveIndicator } from "@/components/ui/auto-save-indicator";
import { FeatureGate, FeatureGateInline } from "@/components/features/FeatureGate";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";

export default function SettingsPage() {
  const { user, currentClinic } = useAuth();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [clinicName, setClinicName] = useState("Clínica Saúde Total");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState("24");
  const [enforceScheduleValidation, setEnforceScheduleValidation] = useState(true);
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [mapViewType, setMapViewType] = useState("streetview");
  const [customMapEmbedUrl, setCustomMapEmbedUrl] = useState("");
  
  // WhatsApp header image state
  const [whatsappHeaderImage, setWhatsappHeaderImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // CPF appointment limit state
  const [maxCpfAppointments, setMaxCpfAppointments] = useState<number | null>(null);
  const [savingCpfLimit, setSavingCpfLimit] = useState(false);

  // Initial data for auto-save comparison
  const [initialSettingsData, setInitialSettingsData] = useState({
    clinicName: "",
    reminderEnabled: true,
    reminderTime: "24",
    mapViewType: "streetview",
    customMapEmbedUrl: "",
  });

  // Current settings data for auto-save
  const settingsData = useMemo(() => ({
    clinicName,
    reminderEnabled,
    reminderTime,
    mapViewType,
    customMapEmbedUrl,
  }), [clinicName, reminderEnabled, reminderTime, mapViewType, customMapEmbedUrl]);

  // Load clinic settings
  useEffect(() => {
    const loadClinicSettings = async () => {
      if (!currentClinic?.id) return;
      
      const { data, error } = await supabase
        .from('clinics')
        .select('enforce_schedule_validation, name, reminder_enabled, reminder_hours, map_view_type, custom_map_embed_url, whatsapp_header_image_url, max_appointments_per_cpf_month')
        .eq('id', currentClinic.id)
        .single();
      
      if (!error && data) {
        setEnforceScheduleValidation(data.enforce_schedule_validation ?? true);
        setClinicName(data.name || "Clínica");
        setReminderEnabled(data.reminder_enabled ?? true);
        setReminderTime(String(data.reminder_hours || 24));
        setMapViewType(data.map_view_type || "streetview");
        setCustomMapEmbedUrl(data.custom_map_embed_url || "");
        setWhatsappHeaderImage(data.whatsapp_header_image_url || null);
        setMaxCpfAppointments(data.max_appointments_per_cpf_month);
        
        // Set initial data for auto-save
        setInitialSettingsData({
          clinicName: data.name || "Clínica",
          reminderEnabled: data.reminder_enabled ?? true,
          reminderTime: String(data.reminder_hours || 24),
          mapViewType: data.map_view_type || "streetview",
          customMapEmbedUrl: data.custom_map_embed_url || "",
        });
      }
    };
    
    loadClinicSettings();
  }, [currentClinic?.id]);

  // Auto-save function
  const performAutoSave = useCallback(async (data: typeof settingsData) => {
    if (!currentClinic?.id) return;
    
    const { error } = await supabase
      .from('clinics')
      .update({ 
        name: data.clinicName,
        reminder_enabled: data.reminderEnabled,
        reminder_hours: parseInt(data.reminderTime),
        map_view_type: data.mapViewType,
        custom_map_embed_url: data.customMapEmbedUrl || null
      })
      .eq('id', currentClinic.id);
    
    if (error) throw error;
    
    // Update initial data after save
    setInitialSettingsData(data);
  }, [currentClinic?.id]);

  // Auto-save hook
  const { status: autoSaveStatus } = useAutoSave({
    data: settingsData,
    initialData: initialSettingsData,
    onSave: performAutoSave,
    enabled: !!currentClinic?.id && hasPermission("manage_settings"),
    validateBeforeSave: (data) => data.clinicName.trim().length > 0,
  });

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

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!currentClinic?.id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('clinics')
        .update({ 
          name: clinicName,
          reminder_enabled: reminderEnabled,
          reminder_hours: parseInt(reminderTime),
          map_view_type: mapViewType,
          custom_map_embed_url: customMapEmbedUrl || null
        })
        .eq('id', currentClinic.id);
      
      if (error) throw error;
      
      toast({
        title: "Configurações salvas",
        description: "Suas alterações foram salvas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle WhatsApp header image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentClinic?.id || !event.target.files || !event.target.files[0]) return;
    
    const file = event.target.files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }
    
    setUploadingImage(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentClinic.id}/whatsapp-header.${fileExt}`;
      
      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('clinic-assets')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('clinic-assets')
        .getPublicUrl(fileName);
      
      // Update clinic record
      const { error: updateError } = await supabase
        .from('clinics')
        .update({ whatsapp_header_image_url: publicUrl })
        .eq('id', currentClinic.id);
      
      if (updateError) throw updateError;
      
      setWhatsappHeaderImage(publicUrl);
      
      toast({
        title: "Imagem enviada",
        description: "A imagem do cabeçalho WhatsApp foi atualizada com sucesso.",
      });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: "Erro ao enviar imagem",
        description: error.message || "Não foi possível enviar a imagem.",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle WhatsApp header image removal
  const handleRemoveImage = async () => {
    if (!currentClinic?.id) return;
    
    try {
      // Remove from storage
      const { error: deleteError } = await supabase.storage
        .from('clinic-assets')
        .remove([`${currentClinic.id}/whatsapp-header.jpg`, `${currentClinic.id}/whatsapp-header.png`, `${currentClinic.id}/whatsapp-header.webp`]);
      
      // Update clinic record (ignore storage delete error as file might not exist)
      const { error: updateError } = await supabase
        .from('clinics')
        .update({ whatsapp_header_image_url: null })
        .eq('id', currentClinic.id);
      
      if (updateError) throw updateError;
      
      setWhatsappHeaderImage(null);
      
      toast({
        title: "Imagem removida",
        description: "A imagem do cabeçalho WhatsApp foi removida. Será usada a imagem padrão do sistema.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao remover imagem",
        description: error.message || "Não foi possível remover a imagem.",
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos de senha.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter no mínimo 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) throw error;

      toast({
        title: "Senha alterada",
        description: "Sua senha foi alterada com sucesso!",
      });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message || "Não foi possível alterar a senha.",
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <RoleGuard permissions={["manage_settings", "change_password"]}>
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">
            Personalize as configurações da sua clínica
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <RoleGuard permission="manage_settings">

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

      {/* Notifications - Protected by whatsapp_appointment_reminders feature */}
      <FeatureGate feature="whatsapp_appointment_reminders" showUpgradePrompt>
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
                  <option value="1">1 hora antes</option>
                  <option value="2">2 horas antes</option>
                  <option value="6">6 horas antes</option>
                  <option value="12">12 horas antes</option>
                  <option value="24">24 horas antes</option>
                  <option value="48">48 horas antes</option>
                  <option value="72">72 horas antes</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  O lembrete será enviado automaticamente no horário configurado antes da consulta
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </FeatureGate>

      {/* WhatsApp Header Image - Protected by manage_whatsapp_header permission */}
      {hasPermission('manage_whatsapp_header') && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Imagem do Cabeçalho WhatsApp</CardTitle>
                <CardDescription>
                  Personalize a imagem que aparece nos lembretes e mensagens de aniversário
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {/* Preview */}
              <div className="w-full sm:w-48 h-32 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                {whatsappHeaderImage ? (
                  <img 
                    src={whatsappHeaderImage} 
                    alt="Cabeçalho WhatsApp" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-4">
                    <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Imagem padrão do sistema</p>
                  </div>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex-1 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Esta imagem será exibida no topo das mensagens de lembrete de consulta e felicitações de aniversário enviadas via WhatsApp.
                </p>
                <p className="text-xs text-muted-foreground">
                  Recomendação: Imagem com proporção 16:9, tamanho máximo 5MB.
                </p>
                
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingImage}
                      asChild
                    >
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingImage ? "Enviando..." : "Enviar imagem"}
                      </span>
                    </Button>
                  </label>
                  
                  {whatsappHeaderImage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveImage}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* CPF Appointment Limit */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Limite de Agendamentos por CPF</CardTitle>
              <CardDescription>
                Restrinja a quantidade de agendamentos mensais por paciente
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="maxCpfAppointments">Máximo de agendamentos por mês (por profissional)</Label>
            <div className="flex gap-3 items-center">
              <Input
                id="maxCpfAppointments"
                type="number"
                min="0"
                placeholder="Sem limite"
                value={maxCpfAppointments || ""}
                onChange={(e) => setMaxCpfAppointments(e.target.value ? parseInt(e.target.value) : null)}
                className="w-32"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={savingCpfLimit}
                onClick={async () => {
                  if (!currentClinic?.id) return;
                  setSavingCpfLimit(true);
                  try {
                    const { error } = await supabase
                      .from('clinics')
                      .update({ max_appointments_per_cpf_month: maxCpfAppointments || null })
                      .eq('id', currentClinic.id);
                    
                    if (error) throw error;
                    
                    toast({
                      title: "Configuração salva",
                      description: maxCpfAppointments 
                        ? `Limite de ${maxCpfAppointments} agendamento(s) por CPF/mês definido.`
                        : "Limite de agendamentos removido.",
                    });
                  } catch (error: any) {
                    toast({
                      title: "Erro ao salvar",
                      description: error.message || "Não foi possível salvar a configuração.",
                      variant: "destructive",
                    });
                  } finally {
                    setSavingCpfLimit(false);
                  }
                }}
              >
                {savingCpfLimit ? "Salvando..." : "Salvar"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Define quantas vezes um mesmo CPF pode agendar com cada profissional por mês. 
              Deixe em branco ou 0 para não limitar.
            </p>
          </div>
          
          {maxCpfAppointments && maxCpfAppointments > 0 && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                ℹ️ Cada paciente poderá agendar no máximo <strong>{maxCpfAppointments} vez(es)</strong> com 
                cada profissional por mês. A validação ocorre tanto no sistema quanto nos agendamentos via WhatsApp.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Map View Type */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Visualização de Localização</CardTitle>
              <CardDescription>
                Como exibir a localização na página pública do profissional
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RadioGroup value={mapViewType} onValueChange={setMapViewType} className="space-y-3">
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="streetview" id="streetview" className="mt-0.5" />
              <div>
                <Label htmlFor="streetview" className="font-medium cursor-pointer">Street View</Label>
                <p className="text-sm text-muted-foreground">Visualização de rua do Google</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="map" id="map" className="mt-0.5" />
              <div>
                <Label htmlFor="map" className="font-medium cursor-pointer">Mapa</Label>
                <p className="text-sm text-muted-foreground">Mapa com marcador de localização</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="both" id="both" className="mt-0.5" />
              <div>
                <Label htmlFor="both" className="font-medium cursor-pointer">Ambos</Label>
                <p className="text-sm text-muted-foreground">Street View + link para o mapa</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="custom" id="custom" className="mt-0.5" />
              <div>
                <Label htmlFor="custom" className="font-medium cursor-pointer">Link Personalizado</Label>
                <p className="text-sm text-muted-foreground">Cole o link de incorporação do Google Maps</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="none" id="none" className="mt-0.5" />
              <div>
                <Label htmlFor="none" className="font-medium cursor-pointer">Nenhum</Label>
                <p className="text-sm text-muted-foreground">Não exibir mapa ou street view</p>
              </div>
            </div>
          </RadioGroup>

          {/* Custom Embed URL Input */}
          {mapViewType === 'custom' && (
            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="customMapEmbed">Link de Incorporação</Label>
                <Textarea
                  id="customMapEmbed"
                  placeholder='Cole aqui o código de incorporação do Google Maps (ex: <iframe src="https://www.google.com/maps/embed?..." ...></iframe>)'
                  value={customMapEmbedUrl}
                  onChange={(e) => setCustomMapEmbedUrl(e.target.value)}
                  rows={4}
                  className="font-mono text-xs"
                />
              </div>
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2 flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Como obter o link de incorporação:
                </p>
                <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 ml-6 list-decimal">
                  <li>Abra o <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Google Maps</a></li>
                  <li>Pesquise o endereço ou ative o Street View</li>
                  <li>Clique no menu (≡) → "Compartilhar ou incorporar mapa"</li>
                  <li>Selecione a aba "Incorporar um mapa"</li>
                  <li>Copie o código HTML completo</li>
                </ol>
              </div>
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

      {/* WhatsApp Provider Selector - Protected by Evolution or Twilio feature */}
      {currentClinic && (
        <FeatureGateInline feature="whatsapp_evolution_api">
          <WhatsAppProviderSelector clinicId={currentClinic.id} />
        </FeatureGateInline>
      )}

      {/* Evolution API Integration - Protected by whatsapp_evolution_api feature */}
      {currentClinic && (
        <FeatureGate feature="whatsapp_evolution_api" showUpgradePrompt>
          <EvolutionConfigPanel clinicId={currentClinic.id} />
        </FeatureGate>
      )}

      {/* Twilio WhatsApp Integration - Protected by whatsapp_twilio feature */}
      {currentClinic && (
        <FeatureGate feature="whatsapp_twilio" showUpgradePrompt>
          <TwilioConfigPanel clinicId={currentClinic.id} />
        </FeatureGate>
      )}

      {/* Message History */}
      {currentClinic && (
        <MessageHistoryPanel clinicId={currentClinic.id} />
      )}

      {/* API Integrations */}
      {currentClinic && (
        <ApiKeysPanel clinicId={currentClinic.id} />
      )}

      {/* Webhooks */}
      <WebhooksPanel />

      {/* AI Assistant Test - Protected by whatsapp_ai_assistant feature */}
      {currentClinic && (
        <FeatureGate feature="whatsapp_ai_assistant" showUpgradePrompt>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Testar Assistente IA</CardTitle>
                  <CardDescription>
                    Teste o assistente de agendamento com OpenAI diretamente
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <AIAssistantChat clinicId={currentClinic.id} />
            </CardContent>
          </Card>
        </FeatureGate>
      )}

      <div className="flex justify-end">
        <Button variant="hero" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
      </RoleGuard>

      {/* Password Change - Protected by change_password permission */}
      {hasPermission('change_password') && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Alterar Senha</CardTitle>
                <CardDescription>
                  Atualize sua senha de acesso
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha"
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme a nova senha"
                minLength={6}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A senha deve ter no mínimo 6 caracteres
            </p>
            <Button
              onClick={handleChangePassword}
              disabled={savingPassword || !newPassword || !confirmPassword}
              className="w-full sm:w-auto"
            >
              {savingPassword ? "Alterando..." : "Alterar Senha"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
    </RoleGuard>
  );
}
