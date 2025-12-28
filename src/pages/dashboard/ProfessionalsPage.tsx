import { useEffect, useState, useCallback } from "react";
import { 
  Plus, 
  MoreVertical,
  Clock,
  Calendar,
  Loader2,
  Settings,
  UserCheck,
  Edit,
  CalendarDays,
  UserX,
  AlertTriangle,
  Sparkles,
  User,
  Video,
  Link,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { ScheduleDialog } from "@/components/professionals/ScheduleDialog";
import { SpecialtySelector } from "@/components/professionals/SpecialtySelector";
import { ProfessionalFormFields } from "@/components/professionals/ProfessionalFormFields";
import { useSpecialties } from "@/hooks/useSpecialties";
import { useSubscription } from "@/hooks/useSubscription";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { Json } from "@/integrations/supabase/types";
import { Switch } from "@/components/ui/switch";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { RealtimeIndicator } from "@/components/ui/realtime-indicator";

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  registration_number: string | null;
  phone: string | null;
  is_active: boolean;
  schedule: Json;
  user_id: string | null;
  email: string | null;
  avatar_url: string | null;
  telemedicine_enabled: boolean;
  slug: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  whatsapp: string | null;
  bio: string | null;
  education: string | null;
  experience: string | null;
  specialtyNames?: string[];
}

interface ProfessionalSpecialtyData {
  specialty: { id: string; name: string } | null;
}

interface ClinicUser {
  user_id: string;
  profile: { name: string; user_id: string } | null;
  user_email: string | null;
}

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  patient: { name: string } | null;
}

const professionalSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(100),
  specialty: z.string().optional(),
  registration_number: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
});

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function ProfessionalsPage() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    loading: loadingSpecialties,
    groupedSpecialties,
    saveProfessionalSpecialties,
    fetchProfessionalSpecialties,
    getSpecialtyById,
    getRegistrationPrefix,
  } = useSpecialties();
  const {
    subscription,
    loading: loadingSubscription,
    canAddProfessional,
    isAtLimit,
    professionalCount: subProfessionalCount,
    refetch: refetchSubscription,
  } = useSubscription();
  const { hasFeature } = usePlanFeatures();
  const { hasPermission } = usePermissions();
  const canManageProfessionals = hasPermission("manage_professionals");
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [clinicUsers, setClinicUsers] = useState<ClinicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Additional dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [scheduleViewDialogOpen, setScheduleViewDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  
  // Form state for create
  const [formName, setFormName] = useState("");
  const [formSpecialtyIds, setFormSpecialtyIds] = useState<string[]>([]);
  const [formCRM, setFormCRM] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formUserId, setFormUserId] = useState<string>("");
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string }>({});

  // Public profile fields for create
  const [formAddress, setFormAddress] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formZipCode, setFormZipCode] = useState("");
  const [formWhatsapp, setFormWhatsapp] = useState("");
  const [formBio, setFormBio] = useState("");
  const [formEducation, setFormEducation] = useState("");
  const [formExperience, setFormExperience] = useState("");

  // Form state for edit
  const [editName, setEditName] = useState("");
  const [editSpecialtyIds, setEditSpecialtyIds] = useState<string[]>([]);
  const [editCRM, setEditCRM] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editUserId, setEditUserId] = useState<string>("");
  const [editErrors, setEditErrors] = useState<{ name?: string; email?: string }>({});

  // Public profile fields for edit
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editZipCode, setEditZipCode] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editEducation, setEditEducation] = useState("");
  const [editExperience, setEditExperience] = useState("");

  // Avatar upload state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);

  // Telemedicine state
  const [formTelemedicineEnabled, setFormTelemedicineEnabled] = useState(false);
  const [editTelemedicineEnabled, setEditTelemedicineEnabled] = useState(false);

  const fetchProfessionals = useCallback(async () => {
    if (!currentClinic) return;
    
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name, specialty, registration_number, phone, is_active, schedule, user_id, email, avatar_url, telemedicine_enabled, slug, address, city, state, zip_code, whatsapp, bio, education, experience')
        .eq('clinic_id', currentClinic.id)
        .order('name');

      if (error) throw error;
      
      // Fetch specialties for each professional
      const professionalsWithSpecialties = await Promise.all(
        (data || []).map(async (prof) => {
          const { data: specData } = await supabase
            .from('professional_specialties')
            .select('specialty:specialties(id, name)')
            .eq('professional_id', prof.id);
          
          const specialtyNames = (specData || [])
            .map((s: ProfessionalSpecialtyData) => s.specialty?.name)
            .filter((n): n is string => !!n);
          
          return { ...prof, specialtyNames };
        })
      );
      
      setProfessionals(professionalsWithSpecialties);
    } catch (error) {
      console.error("Error fetching professionals:", error);
    } finally {
      setLoading(false);
    }
  }, [currentClinic]);

  useEffect(() => {
    if (currentClinic) {
      fetchProfessionals();
      fetchClinicUsers();
    }
  }, [currentClinic, fetchProfessionals]);

  // Realtime subscription for automatic updates
  useRealtimeSubscription({
    table: "professionals",
    filter: currentClinic ? { column: "clinic_id", value: currentClinic.id } : undefined,
    onInsert: () => fetchProfessionals(),
    onUpdate: () => fetchProfessionals(),
    onDelete: () => fetchProfessionals(),
    enabled: !!currentClinic,
  });

  const fetchClinicUsers = async () => {
    if (!currentClinic) return;
    
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('clinic_id', currentClinic.id);

      if (rolesError) throw rolesError;
      
      if (!rolesData || rolesData.length === 0) {
        setClinicUsers([]);
        return;
      }

      const userIds = rolesData.map(r => r.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const users: ClinicUser[] = (profilesData || []).map(p => ({
        user_id: p.user_id,
        profile: { name: p.name, user_id: p.user_id },
        user_email: null,
      }));
      
      setClinicUsers(users);
    } catch (error) {
      console.error("Error fetching clinic users:", error);
    }
  };

  const fetchUpcomingAppointments = async (professionalId: string) => {
    if (!currentClinic) return;
    
    setLoadingAppointments(true);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          start_time,
          end_time,
          status,
          patient:patients (name)
        `)
        .eq('professional_id', professionalId)
        .eq('clinic_id', currentClinic.id)
        .gte('appointment_date', today)
        .in('status', ['scheduled', 'confirmed'])
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(10);

      if (error) throw error;
      setUpcomingAppointments(data as Appointment[]);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setLoadingAppointments(false);
    }
  };

  const handleCreateProfessional = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = professionalSchema.safeParse({
      name: formName,
      registration_number: formCRM || undefined,
      phone: formPhone || undefined,
      email: formEmail || undefined,
    });
    
    if (!validation.success) {
      const errors: typeof formErrors = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0] === "name") errors.name = err.message;
        if (err.path[0] === "email") errors.email = err.message;
      });
      setFormErrors(errors);
      return;
    }

    if (!currentClinic) return;

    setSaving(true);
    setFormErrors({});

    try {
      // Get display name from selected specialties
      const specialtyNames = formSpecialtyIds
        .map(id => getSpecialtyById(id)?.name)
        .filter((n): n is string => !!n);
      const specialtyDisplay = specialtyNames.join(', ') || null;
      
      // Generate slug from name
      const slug = generateSlug(formName);
      
      const { data: newProfessional, error } = await supabase
        .from('professionals')
        .insert({
          clinic_id: currentClinic.id,
          name: formName.trim(),
          specialty: specialtyDisplay,
          registration_number: formCRM.trim() || null,
          phone: formPhone.trim() || null,
          email: formEmail.trim() || null,
          user_id: formUserId || null,
          telemedicine_enabled: hasFeature('telemedicine') ? formTelemedicineEnabled : false,
          slug,
          address: formAddress.trim() || null,
          city: formCity.trim() || null,
          state: formState || null,
          zip_code: formZipCode.replace(/\D/g, '') || null,
          whatsapp: formWhatsapp.replace(/\D/g, '') || null,
          bio: formBio.trim() || null,
          education: formEducation.trim() || null,
          experience: formExperience.trim() || null,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Upload avatar if selected
      if (newProfessional && avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${currentClinic.id}/${newProfessional.id}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('professional-avatars')
          .upload(filePath, avatarFile, { upsert: true });
        
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('professional-avatars')
            .getPublicUrl(filePath);
          
          await supabase
            .from('professionals')
            .update({ avatar_url: urlData.publicUrl })
            .eq('id', newProfessional.id);
        }
      }

      // Save professional specialties
      if (newProfessional && formSpecialtyIds.length > 0) {
        const result = await saveProfessionalSpecialties(newProfessional.id, formSpecialtyIds);
        if (!result.success) {
          toast({
            title: "Aviso",
            description: "Profissional criado, mas houve um problema ao salvar especialidades: " + result.error,
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Profissional cadastrado",
        description: formUserId 
          ? "O profissional foi vinculado e pode acessar o portal." 
          : "O profissional foi adicionado com sucesso.",
      });

      setDialogOpen(false);
      resetForm();
      fetchProfessionals();
      refetchSubscription();
    } catch (error: any) {
      // Handle professional limit error
      if (error.message?.includes('LIMITE_PROFISSIONAIS')) {
        const match = error.message.match(/LIMITE_PROFISSIONAIS: (.+)/);
        toast({
          title: "Limite de profissionais atingido",
          description: match ? match[1] : "Você atingiu o limite de profissionais do seu plano. Faça upgrade para adicionar mais.",
          variant: "destructive",
        });
        return;
      }
      if (error.message?.includes('ASSINATURA_INVALIDA')) {
        const match = error.message.match(/ASSINATURA_INVALIDA: (.+)/);
        toast({
          title: "Assinatura inválida",
          description: match ? match[1] : "Sua assinatura não está ativa.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Erro ao cadastrar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormSpecialtyIds([]);
    setFormCRM("");
    setFormPhone("");
    setFormEmail("");
    setFormUserId("");
    setFormErrors({});
    setAvatarFile(null);
    setAvatarPreview(null);
    setFormTelemedicineEnabled(false);
    setFormAddress("");
    setFormCity("");
    setFormState("");
    setFormZipCode("");
    setFormWhatsapp("");
    setFormBio("");
    setFormEducation("");
    setFormExperience("");
  };

  const openScheduleDialog = (professional: Professional) => {
    setSelectedProfessional(professional);
    setScheduleDialogOpen(true);
  };

  const handleViewSchedule = (professional: Professional) => {
    setSelectedProfessional(professional);
    fetchUpcomingAppointments(professional.id);
    setScheduleViewDialogOpen(true);
  };

  const handleOpenEdit = (professional: Professional) => {
    navigate(`/dashboard/professionals/${professional.id}/edit`);
  };

  const handleEditProfessional = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfessional || !currentClinic) return;

    const validation = professionalSchema.safeParse({
      name: editName,
      registration_number: editCRM || undefined,
      phone: editPhone || undefined,
      email: editEmail || undefined,
    });
    
    if (!validation.success) {
      const errors: typeof editErrors = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0] === "name") errors.name = err.message;
        if (err.path[0] === "email") errors.email = err.message;
      });
      setEditErrors(errors);
      return;
    }

    setSaving(true);
    setEditErrors({});

    try {
      // Get display name from selected specialties
      const specialtyNames = editSpecialtyIds
        .map(id => getSpecialtyById(id)?.name)
        .filter((n): n is string => !!n);
      const specialtyDisplay = specialtyNames.join(', ') || null;

      // Upload new avatar if selected
      let avatarUrl = selectedProfessional.avatar_url;
      if (editAvatarFile && currentClinic) {
        const fileExt = editAvatarFile.name.split('.').pop();
        const filePath = `${currentClinic.id}/${selectedProfessional.id}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('professional-avatars')
          .upload(filePath, editAvatarFile, { upsert: true });
        
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('professional-avatars')
            .getPublicUrl(filePath);
          avatarUrl = urlData.publicUrl;
        }
      }

      // Generate new slug if name changed
      const newSlug = editName !== selectedProfessional.name 
        ? generateSlug(editName) 
        : selectedProfessional.slug;
      
      const { error } = await supabase
        .from('professionals')
        .update({
          name: editName.trim(),
          specialty: specialtyDisplay,
          registration_number: editCRM.trim() || null,
          phone: editPhone.trim() || null,
          email: editEmail.trim() || null,
          user_id: editUserId || null,
          avatar_url: avatarUrl,
          telemedicine_enabled: hasFeature('telemedicine') ? editTelemedicineEnabled : false,
          slug: newSlug,
          address: editAddress.trim() || null,
          city: editCity.trim() || null,
          state: editState || null,
          zip_code: editZipCode.replace(/\D/g, '') || null,
          whatsapp: editWhatsapp.replace(/\D/g, '') || null,
          bio: editBio.trim() || null,
          education: editEducation.trim() || null,
          experience: editExperience.trim() || null,
        })
        .eq('id', selectedProfessional.id);

      if (error) throw error;

      // Save professional specialties
      const result = await saveProfessionalSpecialties(selectedProfessional.id, editSpecialtyIds);
      if (!result.success) {
        toast({
          title: "Aviso",
          description: "Profissional atualizado, mas houve um problema ao salvar especialidades: " + result.error,
          variant: "destructive",
        });
      }

      toast({
        title: "Profissional atualizado",
        description: "As informações foram salvas com sucesso.",
      });

      setEditDialogOpen(false);
      fetchProfessionals();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDeactivate = (professional: Professional) => {
    setSelectedProfessional(professional);
    setDeactivateDialogOpen(true);
  };

  const handleDeactivateProfessional = async () => {
    if (!selectedProfessional) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from('professionals')
        .update({ is_active: !selectedProfessional.is_active })
        .eq('id', selectedProfessional.id);

      if (error) throw error;

      toast({
        title: selectedProfessional.is_active ? "Profissional desativado" : "Profissional ativado",
        description: selectedProfessional.is_active 
          ? "O profissional não aparecerá mais para agendamentos." 
          : "O profissional está disponível para agendamentos.",
      });

      setDeactivateDialogOpen(false);
      fetchProfessionals();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getScheduleSummary = (schedule: Json) => {
    if (!schedule || typeof schedule !== 'object') return "Não configurado";
    
    const scheduleObj = schedule as Record<string, { enabled: boolean; slots: { start: string; end: string }[] }>;
    const activeDays = Object.entries(scheduleObj)
      .filter(([_, day]) => day?.enabled)
      .length;
    
    if (activeDays === 0) return "Não configurado";
    return `${activeDays} dias/semana`;
  };

  const formatAppointmentDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Hoje";
    if (isTomorrow(date)) return "Amanhã";
    return format(date, "dd/MM", { locale: ptBR });
  };

  const getPublicProfileUrl = (professional: Professional) => {
    if (!currentClinic || !professional.slug) return null;
    return `${window.location.origin}/profissional/${currentClinic.slug}/${professional.slug}`;
  };

  const handleCopyLink = async (professional: Professional) => {
    const url = getPublicProfileUrl(professional);
    if (!url) return;
    
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(professional.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({
        title: "Link copiado!",
        description: "O link do perfil público foi copiado.",
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      });
    }
  };

  const maxProfessionals = subscription?.plan?.max_professionals || 999;
  const activeProfessionals = professionals.filter(p => p.is_active).length;
  const usagePercentage = subscription ? (activeProfessionals / maxProfessionals) * 100 : 0;

  return (
    <RoleGuard permission="view_professionals">
    <div className="space-y-6">
      {/* Limit Alert */}
      {subscription && isAtLimit && (
        <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-yellow-800 dark:text-yellow-200">
              Você atingiu o limite de {maxProfessionals} profissional(is) do plano {subscription.plan.name}.
            </span>
            <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/subscription')}>
              <Sparkles className="h-4 w-4 mr-1" />
              Fazer upgrade
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profissionais</h1>
          <p className="text-muted-foreground">
            Gerencie os profissionais da clínica
          </p>
          {subscription && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {activeProfessionals}/{maxProfessionals} profissionais
              </span>
              <Progress value={usagePercentage} className="h-2 w-24" />
            </div>
          )}
        </div>
        {canManageProfessionals && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" disabled={!canAddProfessional && !!subscription}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Profissional
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Cadastrar Profissional</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <form onSubmit={handleCreateProfessional} className="space-y-4">
                <div>
                  <Label htmlFor="profName">Nome *</Label>
                  <Input
                    id="profName"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Dr. João Silva"
                    className={`mt-1.5 ${formErrors.name ? "border-destructive" : ""}`}
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-destructive">{formErrors.name}</p>
                  )}
                </div>
                <SpecialtySelector
                  selectedIds={formSpecialtyIds}
                  onChange={setFormSpecialtyIds}
                  groupedSpecialties={groupedSpecialties}
                  loading={loadingSpecialties}
                  getSpecialtyById={getSpecialtyById}
                />
                <div>
                  <Label htmlFor="profCRM">CRM / Registro</Label>
                  <Input
                    id="profCRM"
                    value={formCRM}
                    onChange={(e) => setFormCRM(e.target.value)}
                    placeholder="123456-SP"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="profPhone">Telefone</Label>
                  <Input
                    id="profPhone"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="profEmail">Email</Label>
                  <Input
                    id="profEmail"
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="profissional@email.com"
                    className={`mt-1.5 ${formErrors.email ? "border-destructive" : ""}`}
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-sm text-destructive">{formErrors.email}</p>
                  )}
                </div>
                
                {/* Avatar upload */}
                <div>
                  <Label>Foto do Profissional</Label>
                  <div className="mt-2 flex items-center gap-4">
                    {avatarPreview ? (
                      <img 
                        src={avatarPreview} 
                        alt="Preview" 
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-8 w-8 text-primary/60" />
                      </div>
                    )}
                    <div className="flex-1">
                      <Input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setAvatarFile(file);
                            setAvatarPreview(URL.createObjectURL(file));
                          }
                        }}
                        className="cursor-pointer"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        A foto será exibida no agendamento online
                      </p>
                    </div>
                  </div>
                </div>

                {/* Telemedicine Toggle */}
                {hasFeature('telemedicine') && (
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3">
                      <Video className="h-5 w-5 text-primary" />
                      <div>
                        <Label htmlFor="formTelemedicine" className="cursor-pointer">
                          Atende por Telemedicina
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Habilitar consultas online por vídeo
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="formTelemedicine"
                      checked={formTelemedicineEnabled}
                      onCheckedChange={setFormTelemedicineEnabled}
                    />
                  </div>
                )}
                
                {clinicUsers.length > 0 && (
                  <div>
                    <Label htmlFor="profUser">Vincular usuário (Portal do Profissional)</Label>
                    <Select value={formUserId || "none"} onValueChange={(val) => setFormUserId(val === "none" ? "" : val)}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Selecione um usuário (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {clinicUsers
                          .filter(u => !professionals.some(p => p.user_id === u.user_id))
                          .map((user) => (
                            <SelectItem key={user.user_id} value={user.user_id}>
                              {user.profile?.name || "Usuário sem nome"}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Vincular permite que o profissional acesse o portal em /profissional
                    </p>
                  </div>
                )}

                {/* Public Profile Fields */}
                <ProfessionalFormFields
                  address={formAddress}
                  setAddress={setFormAddress}
                  city={formCity}
                  setCity={setFormCity}
                  state={formState}
                  setState={setFormState}
                  zipCode={formZipCode}
                  setZipCode={setFormZipCode}
                  whatsapp={formWhatsapp}
                  setWhatsapp={setFormWhatsapp}
                  bio={formBio}
                  setBio={setFormBio}
                  education={formEducation}
                  setEducation={setFormEducation}
                  experience={formExperience}
                  setExperience={setFormExperience}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Cadastrar
                  </Button>
                </div>
              </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          Carregando profissionais...
        </div>
      ) : professionals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {professionals.map((professional) => (
            <Card key={professional.id} className="card-hover">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center">
                      {professional.avatar_url ? (
                        <img 
                          src={professional.avatar_url} 
                          alt={professional.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl font-semibold text-primary">
                          {professional.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {professional.name}
                      </h3>
                      {professional.specialty && (
                        <p className="text-sm text-muted-foreground">
                          {professional.specialty}
                        </p>
                      )}
                      {professional.registration_number && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          CRM: {professional.registration_number}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {professional.telemedicine_enabled && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Video className="h-3 w-3" />
                            Telemedicina
                          </Badge>
                        )}
                        {professional.slug && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Link className="h-3 w-3" />
                            Perfil público
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => handleViewSchedule(professional)}>
                        <CalendarDays className="h-4 w-4 mr-2" />
                        Ver agenda
                      </DropdownMenuItem>
                      {canManageProfessionals && (
                        <>
                          <DropdownMenuItem onClick={() => handleOpenEdit(professional)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openScheduleDialog(professional)}>
                            <Settings className="h-4 w-4 mr-2" />
                            Configurar horários
                          </DropdownMenuItem>
                        </>
                      )}
                      {professional.slug && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleCopyLink(professional)}>
                            {copiedId === professional.id ? (
                              <Check className="h-4 w-4 mr-2 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4 mr-2" />
                            )}
                            Copiar link público
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => window.open(getPublicProfileUrl(professional) || '', '_blank')}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Ver página pública
                          </DropdownMenuItem>
                        </>
                      )}
                      {canManageProfessionals && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className={professional.is_active ? "text-destructive" : "text-green-600"}
                            onClick={() => handleOpenDeactivate(professional)}
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            {professional.is_active ? "Desativar" : "Ativar"}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      {getScheduleSummary(professional.schedule)}
                    </span>
                    {professional.user_id && (
                      <Badge variant="secondary" className="text-xs">
                        <UserCheck className="h-3 w-3 mr-1" />
                        Vinculado
                      </Badge>
                    )}
                  </div>
                  <Badge variant={professional.is_active ? "default" : "outline"}>
                    {professional.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="mb-4">Nenhum profissional cadastrado</p>
            {canManageProfessionals && (
              <Button variant="outline" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar profissional
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Schedule Configuration Dialog */}
      {selectedProfessional && (
        <ScheduleDialog
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
          professional={{
            id: selectedProfessional.id,
            name: selectedProfessional.name,
            schedule: selectedProfessional.schedule as Record<string, { enabled: boolean; slots: { start: string; end: string }[] }> | null,
          }}
          onUpdate={fetchProfessionals}
        />
      )}

      {/* View Schedule Dialog */}
      <Dialog open={scheduleViewDialogOpen} onOpenChange={setScheduleViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agenda - {selectedProfessional?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {loadingAppointments ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Carregando consultas...
              </div>
            ) : upcomingAppointments.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">Próximas consultas:</p>
                {upcomingAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <div>
                      <p className="font-medium text-sm">{apt.patient?.name || "Paciente"}</p>
                      <p className="text-xs text-muted-foreground">
                        {apt.start_time.slice(0, 5)} - {apt.end_time.slice(0, 5)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {formatAppointmentDate(apt.appointment_date)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Nenhuma consulta agendada</p>
              </div>
            )}
            
            <div className="pt-4 border-t">
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => {
                  setScheduleViewDialogOpen(false);
                  navigate(`/dashboard/calendar?professional=${selectedProfessional?.id}`);
                }}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Ver agenda completa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Professional Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Editar Profissional</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <form onSubmit={handleEditProfessional} className="space-y-4">
              <div>
                <Label htmlFor="editProfName">Nome *</Label>
                <Input
                  id="editProfName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`mt-1.5 ${editErrors.name ? "border-destructive" : ""}`}
                />
                {editErrors.name && (
                  <p className="mt-1 text-sm text-destructive">{editErrors.name}</p>
                )}
              </div>
              <SpecialtySelector
                selectedIds={editSpecialtyIds}
                onChange={setEditSpecialtyIds}
                groupedSpecialties={groupedSpecialties}
                loading={loadingSpecialties}
                getSpecialtyById={getSpecialtyById}
              />
              <div>
                <Label htmlFor="editProfCRM">CRM / Registro</Label>
                <Input
                  id="editProfCRM"
                  value={editCRM}
                  onChange={(e) => setEditCRM(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="editProfPhone">Telefone</Label>
                <Input
                  id="editProfPhone"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="editProfEmail">Email</Label>
                <Input
                  id="editProfEmail"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className={`mt-1.5 ${editErrors.email ? "border-destructive" : ""}`}
                />
                {editErrors.email && (
                  <p className="mt-1 text-sm text-destructive">{editErrors.email}</p>
                )}
              </div>
              
              {/* Avatar upload for edit */}
              <div>
                <Label>Foto do Profissional</Label>
                <div className="mt-2 flex items-center gap-4">
                  {editAvatarPreview ? (
                    <img 
                      src={editAvatarPreview} 
                      alt="Preview" 
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-8 w-8 text-primary/60" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setEditAvatarFile(file);
                          setEditAvatarPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="cursor-pointer"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      A foto será exibida no agendamento online
                    </p>
                  </div>
                </div>
              </div>

              {/* Telemedicine Toggle for Edit */}
              {hasFeature('telemedicine') && (
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    <Video className="h-5 w-5 text-primary" />
                    <div>
                      <Label htmlFor="editTelemedicine" className="cursor-pointer">
                        Atende por Telemedicina
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Habilitar consultas online por vídeo
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="editTelemedicine"
                    checked={editTelemedicineEnabled}
                    onCheckedChange={setEditTelemedicineEnabled}
                  />
                </div>
              )}
              
              {clinicUsers.length > 0 && (
                <div>
                  <Label htmlFor="editProfUser">Vincular usuário</Label>
                  <Select value={editUserId || "none"} onValueChange={(val) => setEditUserId(val === "none" ? "" : val)}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecione um usuário (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {clinicUsers
                        .filter(u => 
                          !professionals.some(p => p.user_id === u.user_id && p.id !== selectedProfessional?.id)
                        )
                        .map((user) => (
                          <SelectItem key={user.user_id} value={user.user_id}>
                            {user.profile?.name || "Usuário sem nome"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Public Profile Fields for Edit */}
              <ProfessionalFormFields
                address={editAddress}
                setAddress={setEditAddress}
                city={editCity}
                setCity={setEditCity}
                state={editState}
                setState={setEditState}
                zipCode={editZipCode}
                setZipCode={setEditZipCode}
                whatsapp={editWhatsapp}
                setWhatsapp={setEditWhatsapp}
                bio={editBio}
                setBio={setEditBio}
                education={editEducation}
                setEducation={setEditEducation}
                experience={editExperience}
                setExperience={setEditExperience}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedProfessional?.is_active ? "Desativar profissional?" : "Ativar profissional?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedProfessional?.is_active 
                ? `Tem certeza que deseja desativar ${selectedProfessional?.name}? O profissional não aparecerá mais para novos agendamentos.`
                : `Tem certeza que deseja ativar ${selectedProfessional?.name}? O profissional ficará disponível para agendamentos.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivateProfessional}
              className={selectedProfessional?.is_active 
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
              }
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedProfessional?.is_active ? "Desativar" : "Ativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </RoleGuard>
  );
}