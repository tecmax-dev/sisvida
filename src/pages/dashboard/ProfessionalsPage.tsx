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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { ScheduleDialog } from "@/components/professionals/ScheduleDialog";
import { useSubscription } from "@/hooks/useSubscription";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { Json } from "@/integrations/supabase/types";
import { Switch } from "@/components/ui/switch";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

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
  appointment_duration: number | null;
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
  const [saving, setSaving] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Dialog states
  const [scheduleViewDialogOpen, setScheduleViewDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  // Filter state - show only active by default
  const [showInactive, setShowInactive] = useState(false);

  const fetchProfessionals = useCallback(async () => {
    if (!currentClinic) return;
    
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name, specialty, registration_number, phone, is_active, schedule, user_id, email, avatar_url, telemedicine_enabled, slug, address, city, state, zip_code, whatsapp, bio, education, experience, appointment_duration')
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
  const inactiveProfessionals = professionals.filter(p => !p.is_active).length;
  const usagePercentage = subscription ? (activeProfessionals / maxProfessionals) * 100 : 0;
  
  // Filter professionals based on toggle
  const filteredProfessionals = showInactive 
    ? professionals 
    : professionals.filter(p => p.is_active);

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
        <div className="flex items-center gap-4">
          {inactiveProfessionals > 0 && (
            <div className="flex items-center gap-2">
              <Switch
                id="showInactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="showInactive" className="text-sm text-muted-foreground cursor-pointer">
                Mostrar inativos ({inactiveProfessionals})
              </Label>
            </div>
          )}
          {canManageProfessionals && (
            <Button 
              variant="hero" 
              disabled={!canAddProfessional && !!subscription}
              onClick={() => navigate('/dashboard/professionals/new')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Profissional
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          Carregando profissionais...
        </div>
      ) : filteredProfessionals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProfessionals.map((professional) => (
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
            <p className="mb-4">
              {professionals.length === 0 
                ? "Nenhum profissional cadastrado" 
                : "Nenhum profissional ativo encontrado"}
            </p>
            {professionals.length === 0 && canManageProfessionals && (
              <Button variant="outline" onClick={() => navigate('/dashboard/professionals/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar profissional
              </Button>
            )}
            {professionals.length > 0 && !showInactive && (
              <Button variant="outline" onClick={() => setShowInactive(true)}>
                Mostrar inativos ({inactiveProfessionals})
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
          appointmentDuration={(selectedProfessional as any).appointment_duration || 30}
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