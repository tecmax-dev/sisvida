import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Bell, Clock, Globe, ShieldCheck, MapPin, ExternalLink, Lock, ImageIcon, Upload, Trash2, Users, Bot, User, Settings2, RotateCcw, UserCircle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { EvolutionConfigPanel } from "@/components/settings/EvolutionConfigPanel";
import { TwilioConfigPanel } from "@/components/settings/TwilioConfigPanel";
import { WhatsAppProviderSelector } from "@/components/settings/WhatsAppProviderSelector";
import { WhatsAppDelayConfig } from "@/components/settings/WhatsAppDelayConfig";
import { ApiKeysPanel } from "@/components/settings/ApiKeysPanel";
import { WebhooksPanel } from "@/components/settings/WebhooksPanel";
import { MessageHistoryPanel } from "@/components/settings/MessageHistoryPanel";
import { AIAssistantChat } from "@/components/chat/AIAssistantChat";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { usePermissions, Permission } from "@/hooks/usePermissions";
import { useAutoSave, AutoSaveStatus } from "@/hooks/useAutoSave";
import { AutoSaveIndicator } from "@/components/ui/auto-save-indicator";
import { FeatureGate, FeatureGateInline } from "@/components/features/FeatureGate";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { UserAvatarUpload } from "@/components/users/UserAvatarUpload";
import { getNomenclatureOptions } from "@/hooks/useNomenclature";
import { DraggableWidget } from "@/components/settings/DraggableWidget";
import { DroppableColumn } from "@/components/settings/DroppableColumn";
import { useSettingsWidgets, WidgetColumn } from "@/hooks/useSettingsWidgets";
import { Badge } from "@/components/ui/badge";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export default function SettingsPage() {
  const { user, currentClinic, profile, refreshProfile } = useAuth();
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
  
  // Logo state
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [localLogoUrl, setLocalLogoUrl] = useState<string | null>(null);
  
  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // CPF appointment limit state
  const [maxCpfAppointments, setMaxCpfAppointments] = useState<number | null>(null);
  const [savingCpfLimit, setSavingCpfLimit] = useState(false);

  // Entity nomenclature state
  const [entityNomenclature, setEntityNomenclature] = useState("Paciente");
  const [savingNomenclature, setSavingNomenclature] = useState(false);

  // Widget management
  const {
    loading: widgetsLoading,
    isWidgetVisible,
    handleDragEnd,
    moveWidgetUp,
    moveWidgetDown,
    moveWidgetToColumn,
    toggleWidgetVisibility,
    resetToDefault,
    getWidgetsForColumn,
    getWidgetPlacement,
  } = useSettingsWidgets();
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
        .select('enforce_schedule_validation, name, reminder_enabled, reminder_hours, map_view_type, custom_map_embed_url, whatsapp_header_image_url, max_appointments_per_cpf_month, entity_nomenclature, logo_url')
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
        setEntityNomenclature(data.entity_nomenclature || "Paciente");
        setLocalLogoUrl(data.logo_url || null);
        
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

  // Handle Logo upload
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentClinic?.id || !event.target.files || !event.target.files[0]) return;
    
    const file = event.target.files[0];
    
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem.",
        variant: "destructive",
      });
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 2MB.",
        variant: "destructive",
      });
      return;
    }
    
    setUploadingLogo(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentClinic.id}/logo.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('clinic-assets')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('clinic-assets')
        .getPublicUrl(fileName);
      
      const { error: updateError } = await supabase
        .from('clinics')
        .update({ logo_url: publicUrl })
        .eq('id', currentClinic.id);
      
      if (updateError) throw updateError;
      
      // Atualizar estado local em vez de reload
      setLocalLogoUrl(publicUrl);
      
      // Atualizar contexto de autenticação para refletir alterações globalmente
      await refreshProfile();
      
      toast({
        title: "Logo enviada",
        description: "A logo da clínica foi atualizada com sucesso.",
      });
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Erro ao enviar logo",
        description: error.message || "Não foi possível enviar a logo.",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle Logo removal
  const handleRemoveLogo = async () => {
    if (!currentClinic?.id) return;
    
    try {
      await supabase.storage
        .from('clinic-assets')
        .remove([`${currentClinic.id}/logo.jpg`, `${currentClinic.id}/logo.png`, `${currentClinic.id}/logo.webp`]);
      
      const { error: updateError } = await supabase
        .from('clinics')
        .update({ logo_url: null })
        .eq('id', currentClinic.id);
      
      if (updateError) throw updateError;
      
      // Atualizar estado local em vez de reload
      setLocalLogoUrl(null);
      
      // Atualizar contexto de autenticação para refletir alterações globalmente
      await refreshProfile();
      
      toast({
        title: "Logo removida",
        description: "A logo da clínica foi removida.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao remover logo",
        description: error.message || "Não foi possível remover a logo.",
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

  // Widget definitions with content
  const widgetDefinitions: Array<{
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    permission: Permission | null;
    feature: string | null;
    content?: React.ReactNode;
    isComponent?: boolean;
    component?: React.ReactNode;
  }> = useMemo(() => [
    {
      id: "profile",
      title: "Meu Perfil",
      description: "Personalize sua foto de perfil",
      icon: <User className="h-5 w-5 text-primary" />,
      permission: null,
      feature: null,
      content: (
        <div className="flex items-center gap-6">
          {user?.id && (
            <UserAvatarUpload
              userId={user.id}
              currentAvatarUrl={profile?.avatar_url}
              userName={profile?.name || user?.email || "Usuário"}
              size="lg"
              editable={true}
            />
          )}
          <div className="flex-1">
            <p className="font-medium text-foreground">{profile?.name || "Usuário"}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Clique no ícone de câmera para alterar sua foto
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "clinic-info",
      title: "Dados da Clínica",
      description: "Informações básicas da sua clínica",
      icon: <Building2 className="h-5 w-5 text-primary" />,
      permission: "manage_settings",
      feature: null,
      content: (
        <div className="space-y-6">
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
          
          {/* Logo da Clínica */}
          <div className="space-y-3">
            <Label>Logotipo da Clínica</Label>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="w-32 h-32 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                {currentClinic?.logo_url ? (
                  <img 
                    src={currentClinic.logo_url} 
                    alt="Logo da clínica" 
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <div className="text-center p-4">
                    <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Sem logo</p>
                  </div>
                )}
              </div>
              
              <div className="flex-1 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Esta imagem será exibida no portal da empresa, agendamento online e documentos impressos.
                </p>
                <p className="text-xs text-muted-foreground">
                  Formatos: JPG, PNG ou WebP • Tamanho máximo: 2MB • Recomendado: 200x200px
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadingLogo}
                    onClick={() => document.getElementById('logo-upload')?.click()}
                  >
                    {uploadingLogo ? (
                      <>Enviando...</>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {currentClinic?.logo_url ? 'Alterar Logo' : 'Enviar Logo'}
                      </>
                    )}
                  </Button>
                  {currentClinic?.logo_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveLogo}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover
                    </Button>
                  )}
                </div>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "nomenclature",
      title: "Nomenclatura do Sistema",
      description: "Defina como o sistema se refere aos cadastros de Pessoa Física",
      icon: <UserCircle className="h-5 w-5 text-primary" />,
      permission: "manage_settings",
      feature: null,
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="entityNomenclature">Nome do cadastro titular (Pessoa Física)</Label>
            <div className="flex gap-3 items-center">
              <Select
                value={entityNomenclature}
                onValueChange={setEntityNomenclature}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {getNomenclatureOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                disabled={savingNomenclature}
                onClick={async () => {
                  if (!currentClinic?.id) return;
                  setSavingNomenclature(true);
                  try {
                    const { error } = await supabase
                      .from('clinics')
                      .update({ entity_nomenclature: entityNomenclature })
                      .eq('id', currentClinic.id);
                    
                    if (error) throw error;
                    
                    // Atualizar contexto de autenticação para refletir alterações globalmente
                    await refreshProfile();
                    
                    toast({
                      title: "Nomenclatura salva",
                      description: `O sistema agora utilizará "${entityNomenclature}" para se referir aos cadastros.`,
                    });
                  } catch (error: any) {
                    toast({
                      title: "Erro ao salvar",
                      description: error.message || "Não foi possível salvar a configuração.",
                      variant: "destructive",
                    });
                  } finally {
                    setSavingNomenclature(false);
                  }
                }}
              >
                {savingNomenclature ? "Salvando..." : "Salvar"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Esta configuração define como o sistema irá se referir aos cadastros principais em todas as telas, mensagens, relatórios e comunicações via WhatsApp.
            </p>
          </div>
          
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Preview:</strong> "Cadastrar {entityNomenclature}" | "Lista de {entityNomenclature === 'Paciente' ? 'Pacientes' : entityNomenclature === 'Associado' ? 'Associados' : entityNomenclature === 'Filiado' ? 'Filiados' : entityNomenclature === 'Cliente' ? 'Clientes' : entityNomenclature === 'Beneficiário' ? 'Beneficiários' : entityNomenclature === 'Contribuinte' ? 'Contribuintes' : entityNomenclature === 'Sócio' ? 'Sócios' : entityNomenclature === 'Membro' ? 'Membros' : entityNomenclature + 's'}"
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "whatsapp-reminders",
      title: "Lembretes WhatsApp",
      description: "Configure os lembretes automáticos",
      icon: <Bell className="h-5 w-5 text-primary" />,
      permission: "manage_settings",
      feature: "whatsapp_appointment_reminders",
      content: (
        <div className="space-y-4">
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
        </div>
      ),
    },
    {
      id: "whatsapp-header",
      title: "Imagem do Cabeçalho WhatsApp",
      description: "Personalize a imagem que aparece nos lembretes e mensagens de aniversário",
      icon: <ImageIcon className="h-5 w-5 text-primary" />,
      permission: "manage_whatsapp_header",
      feature: null,
      content: (
        <div className="flex flex-col sm:flex-row gap-4 items-start">
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
      ),
    },
    {
      id: "working-hours",
      title: "Horário de Funcionamento",
      description: "Defina os horários padrão da clínica",
      icon: <Clock className="h-5 w-5 text-primary" />,
      permission: "manage_settings",
      feature: null,
      content: (
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
      ),
    },
    {
      id: "schedule-validation",
      title: "Validação de Horários",
      description: "Controle de agendamentos fora do expediente",
      icon: <ShieldCheck className="h-5 w-5 text-primary" />,
      permission: "manage_settings",
      feature: null,
      content: (
        <div className="space-y-4">
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
        </div>
      ),
    },
    {
      id: "cpf-limit",
      title: "Limite de Agendamentos por CPF",
      description: "Restrinja a quantidade de agendamentos mensais por paciente",
      icon: <Users className="h-5 w-5 text-primary" />,
      permission: "manage_settings",
      feature: null,
      content: (
        <div className="space-y-4">
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
        </div>
      ),
    },
    {
      id: "map-view",
      title: "Visualização de Localização",
      description: "Como exibir a localização na página pública do profissional",
      icon: <MapPin className="h-5 w-5 text-primary" />,
      permission: "manage_settings",
      feature: null,
      content: (
        <>
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
        </>
      ),
    },
    {
      id: "online-booking",
      title: "Agendamento Online",
      description: "Link para agendamento de pacientes",
      icon: <Globe className="h-5 w-5 text-primary" />,
      permission: "manage_settings",
      feature: null,
      content: (
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
      ),
    },
    {
      id: "whatsapp-provider",
      title: "Provedor WhatsApp",
      description: "Selecione o provedor de WhatsApp",
      icon: <Bell className="h-5 w-5 text-primary" />,
      permission: "manage_settings",
      feature: "whatsapp_evolution_api",
      isComponent: true,
      component: currentClinic ? <WhatsAppProviderSelector clinicId={currentClinic.id} /> : null,
    },
    {
      id: "evolution-api",
      title: "Evolution API",
      description: "Configuração do Evolution API",
      icon: <Bell className="h-5 w-5 text-primary" />,
      permission: "manage_settings",
      feature: "whatsapp_evolution_api",
      isComponent: true,
      component: currentClinic ? <EvolutionConfigPanel clinicId={currentClinic.id} /> : null,
    },
    {
      id: "twilio-config",
      title: "Twilio WhatsApp",
      description: "Configuração do Twilio",
      icon: <Bell className="h-5 w-5 text-primary" />,
      permission: "manage_settings",
      feature: "whatsapp_twilio",
      isComponent: true,
      component: currentClinic ? <TwilioConfigPanel clinicId={currentClinic.id} /> : null,
    },
    {
      id: "whatsapp-delay",
      title: "Intervalo de Disparo",
      description: "Configure o intervalo entre mensagens",
      icon: <Clock className="h-5 w-5 text-primary" />,
      permission: "manage_settings",
      feature: "whatsapp_evolution_api",
      isComponent: true,
      component: currentClinic ? <WhatsAppDelayConfig clinicId={currentClinic.id} /> : null,
    },
    {
      id: "message-history",
      title: "Histórico de Mensagens",
      description: "Histórico de mensagens enviadas",
      icon: <Bell className="h-5 w-5 text-primary" />,
      permission: "manage_settings",
      feature: null,
      isComponent: true,
      component: currentClinic ? <MessageHistoryPanel clinicId={currentClinic.id} /> : null,
    },
    {
      id: "api-keys",
      title: "Chaves de API",
      description: "Gerencie suas chaves de API",
      icon: <Lock className="h-5 w-5 text-primary" />,
      permission: "manage_settings",
      feature: null,
      isComponent: true,
      component: currentClinic ? <ApiKeysPanel clinicId={currentClinic.id} /> : null,
    },
    {
      id: "webhooks",
      title: "Webhooks",
      description: "Configure webhooks para integrações",
      icon: <Globe className="h-5 w-5 text-primary" />,
      permission: "manage_settings",
      feature: null,
      isComponent: true,
      component: <WebhooksPanel />,
    },
    {
      id: "ai-assistant",
      title: "Testar Assistente IA",
      description: "Teste o assistente de agendamento com OpenAI diretamente",
      icon: <Bot className="h-5 w-5 text-primary" />,
      permission: "manage_settings",
      feature: "whatsapp_ai_assistant",
      content: currentClinic ? <AIAssistantChat clinicId={currentClinic.id} /> : null,
    },
    {
      id: "password-change",
      title: "Alterar Senha",
      description: "Atualize sua senha de acesso",
      icon: <Lock className="h-5 w-5 text-primary" />,
      permission: "change_password",
      feature: null,
      content: (
        <div className="space-y-4">
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
        </div>
      ),
    },
  ], [
    clinicName, user, profile, reminderEnabled, reminderTime, whatsappHeaderImage, 
    uploadingImage, enforceScheduleValidation, loadingValidation, maxCpfAppointments, 
    savingCpfLimit, mapViewType, customMapEmbedUrl, bookingLink, currentClinic, 
    newPassword, confirmPassword, savingPassword, toast, handleImageUpload, handleRemoveImage, 
    handleToggleScheduleValidation, handleChangePassword
  ]);

  // Get widgets for each column
  const leftColumnWidgets = useMemo(() => {
    const columnPlacements = getWidgetsForColumn("left");
    return columnPlacements
      .map(p => widgetDefinitions.find(w => w.id === p.id))
      .filter((w): w is typeof widgetDefinitions[0] => w !== undefined);
  }, [widgetDefinitions, getWidgetsForColumn]);

  const rightColumnWidgets = useMemo(() => {
    const columnPlacements = getWidgetsForColumn("right");
    return columnPlacements
      .map(p => widgetDefinitions.find(w => w.id === p.id))
      .filter((w): w is typeof widgetDefinitions[0] => w !== undefined);
  }, [widgetDefinitions, getWidgetsForColumn]);

  const leftWidgetIds = useMemo(() => leftColumnWidgets.map(w => w.id), [leftColumnWidgets]);
  const rightWidgetIds = useMemo(() => rightColumnWidgets.map(w => w.id), [rightColumnWidgets]);

  // Find active widget for drag overlay
  const activeWidget = useMemo(() => {
    if (!activeId) return null;
    return widgetDefinitions.find(w => w.id === activeId);
  }, [activeId, widgetDefinitions]);

  // DnD handlers
  const onDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    if (overId === "column-left" || overId === "column-right") {
      const targetColumn = overId === "column-left" ? "left" : "right";
      handleDragEnd(activeId, null, targetColumn);
    } else {
      // Dropped on another widget
      const overWidget = widgetDefinitions.find(w => w.id === overId);
      if (overWidget) {
        const overPlacement = getWidgetPlacement(overId);
        handleDragEnd(activeId, overId, overPlacement?.column || null);
      }
    }
  };

  // Render widget with proper guards
  const renderWidget = (widget: typeof widgetDefinitions[0]) => {
    const isVisible = isWidgetVisible(widget.id);
    
    // Check permission
    if (widget.permission && !hasPermission(widget.permission)) {
      return null;
    }

    // For component widgets (they have their own Card structure)
    if (widget.isComponent && widget.component) {
      if (!isVisible && !isEditMode) return null;
      
      if (widget.feature) {
        return (
          <div key={widget.id} className={!isVisible ? "opacity-50" : ""}>
            <FeatureGate feature={widget.feature} showUpgradePrompt>
              {widget.component}
            </FeatureGate>
          </div>
        );
      }
      
      return (
        <div key={widget.id} className={!isVisible ? "opacity-50" : ""}>
          {widget.component}
        </div>
      );
    }

    // Regular widgets with content
    const widgetContent = (
      <DraggableWidget
        key={widget.id}
        id={widget.id}
        title={widget.title}
        description={widget.description}
        icon={widget.icon}
        isEditMode={isEditMode}
        isVisible={isVisible}
        onToggleVisibility={() => toggleWidgetVisibility(widget.id)}
      >
        {widget.content}
      </DraggableWidget>
    );

    if (widget.feature) {
      return (
        <FeatureGate key={widget.id} feature={widget.feature} showUpgradePrompt>
          {widgetContent}
        </FeatureGate>
      );
    }

    return widgetContent;
  };

  return (
    <RoleGuard permissions={["manage_settings", "change_password"]}>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">
            Personalize as configurações da sua clínica
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AutoSaveIndicator status={autoSaveStatus} />
          
          {/* Widget Edit Mode Toggle */}
          <Button
            variant={isEditMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEditMode(!isEditMode)}
            className="gap-2"
          >
            <Settings2 className="h-4 w-4" />
            {isEditMode ? "Concluir" : "Personalizar"}
          </Button>
        </div>
      </div>

      {/* Edit Mode Instructions */}
      {isEditMode && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Settings2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Modo de personalização ativo</p>
                  <p className="text-sm text-muted-foreground">
                    Arraste os widgets para reordenar ou mover entre colunas. Use o ícone 👁 para ocultar/exibir.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={resetToDefault} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Restaurar padrão
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two column layout with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <DroppableColumn 
            id="column-left" 
            label="Coluna Esquerda" 
            widgetIds={leftWidgetIds}
            isEditMode={isEditMode}
          >
            <RoleGuard permission="manage_settings">
              {leftColumnWidgets
                .filter(w => w.permission === "manage_settings" || w.permission === null)
                .map((widget) => renderWidget(widget))}
            </RoleGuard>
            
            {/* Password change widget if in left column */}
            {hasPermission('change_password') && leftColumnWidgets.some(w => w.id === "password-change") && (
              <>
                {leftColumnWidgets
                  .filter(w => w.id === "password-change")
                  .map((widget) => renderWidget(widget))}
              </>
            )}
          </DroppableColumn>

          {/* Right Column */}
          <DroppableColumn 
            id="column-right" 
            label="Coluna Direita" 
            widgetIds={rightWidgetIds}
            isEditMode={isEditMode}
          >
            <RoleGuard permission="manage_settings">
              {rightColumnWidgets
                .filter(w => w.permission === "manage_settings" || w.permission === null)
                .map((widget) => renderWidget(widget))}
            </RoleGuard>
            
            {/* Password change widget if in right column */}
            {hasPermission('change_password') && rightColumnWidgets.some(w => w.id === "password-change") && (
              <>
                {rightColumnWidgets
                  .filter(w => w.id === "password-change")
                  .map((widget) => renderWidget(widget))}
              </>
            )}
          </DroppableColumn>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeWidget ? (
            <Card className="opacity-90 shadow-xl ring-2 ring-primary">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {activeWidget.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">{activeWidget.title}</CardTitle>
                    {activeWidget.description && (
                      <CardDescription className="text-xs">{activeWidget.description}</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Save button */}
      <RoleGuard permission="manage_settings">
        <div className="flex justify-end">
          <Button variant="hero" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </RoleGuard>
    </div>
    </RoleGuard>
  );
}
