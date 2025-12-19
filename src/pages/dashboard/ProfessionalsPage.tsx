import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { ScheduleDialog } from "@/components/professionals/ScheduleDialog";
import { SpecialtySelector } from "@/components/professionals/SpecialtySelector";
import { useSpecialties } from "@/hooks/useSpecialties";
import { Json } from "@/integrations/supabase/types";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export default function ProfessionalsPage() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { saveProfessionalSpecialties, fetchProfessionalSpecialties, getSpecialtyById, getRegistrationPrefix } = useSpecialties();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [clinicUsers, setClinicUsers] = useState<ClinicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  
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

  // Form state for edit
  const [editName, setEditName] = useState("");
  const [editSpecialtyIds, setEditSpecialtyIds] = useState<string[]>([]);
  const [editCRM, setEditCRM] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editUserId, setEditUserId] = useState<string>("");
  const [editErrors, setEditErrors] = useState<{ name?: string; email?: string }>({});

  useEffect(() => {
    if (currentClinic) {
      fetchProfessionals();
      fetchClinicUsers();
    }
  }, [currentClinic]);

  const fetchProfessionals = async () => {
    if (!currentClinic) return;
    
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name, specialty, registration_number, phone, is_active, schedule, user_id, email')
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
  };

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
        })
        .select('id')
        .single();

      if (error) throw error;

      // Save professional specialties
      if (newProfessional && formSpecialtyIds.length > 0) {
        await saveProfessionalSpecialties(newProfessional.id, formSpecialtyIds);
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
    } catch (error: any) {
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

  const handleOpenEdit = async (professional: Professional) => {
    setSelectedProfessional(professional);
    setEditName(professional.name);
    setEditCRM(professional.registration_number || "");
    setEditPhone(professional.phone || "");
    setEditEmail(professional.email || "");
    setEditUserId(professional.user_id || "");
    setEditErrors({});
    
    // Load existing specialties
    const existingSpecialtyIds = await fetchProfessionalSpecialties(professional.id);
    setEditSpecialtyIds(existingSpecialtyIds);
    
    setEditDialogOpen(true);
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
      
      const { error } = await supabase
        .from('professionals')
        .update({
          name: editName.trim(),
          specialty: specialtyDisplay,
          registration_number: editCRM.trim() || null,
          phone: editPhone.trim() || null,
          email: editEmail.trim() || null,
          user_id: editUserId || null,
        })
        .eq('id', selectedProfessional.id);

      if (error) throw error;

      // Save professional specialties
      await saveProfessionalSpecialties(selectedProfessional.id, editSpecialtyIds);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profissionais</h1>
          <p className="text-muted-foreground">
            Gerencie os profissionais da clínica
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <Plus className="h-4 w-4 mr-2" />
              Novo Profissional
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Profissional</DialogTitle>
            </DialogHeader>
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
          </DialogContent>
        </Dialog>
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
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                      <span className="text-xl font-semibold text-primary">
                        {professional.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                      </span>
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
                      <DropdownMenuItem onClick={() => handleOpenEdit(professional)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openScheduleDialog(professional)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Configurar horários
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className={professional.is_active ? "text-destructive" : "text-green-600"}
                        onClick={() => handleOpenDeactivate(professional)}
                      >
                        <UserX className="h-4 w-4 mr-2" />
                        {professional.is_active ? "Desativar" : "Ativar"}
                      </DropdownMenuItem>
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
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar profissional
            </Button>
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
                  navigate(`/dashboard/agenda?professional=${selectedProfessional?.id}`);
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Profissional</DialogTitle>
          </DialogHeader>
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
  );
}
