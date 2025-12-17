import { useEffect, useState } from "react";
import { 
  Plus, 
  MoreVertical,
  Clock,
  Calendar,
  Loader2,
  Settings,
  UserCheck,
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
  DialogDescription,
} from "@/components/ui/dialog";
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
import { z } from "zod";
import { ScheduleDialog } from "@/components/professionals/ScheduleDialog";
import { Json } from "@/integrations/supabase/types";

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
}

interface ClinicUser {
  user_id: string;
  profile: { name: string; user_id: string } | null;
  user_email: string | null;
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
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [clinicUsers, setClinicUsers] = useState<ClinicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  
  // Form state
  const [formName, setFormName] = useState("");
  const [formSpecialty, setFormSpecialty] = useState("");
  const [formCRM, setFormCRM] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formUserId, setFormUserId] = useState<string>("");
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string }>({});

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
      setProfessionals(data || []);
    } catch (error) {
      console.error("Error fetching professionals:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClinicUsers = async () => {
    if (!currentClinic) return;
    
    try {
      // Get users that have roles in this clinic
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('clinic_id', currentClinic.id);

      if (rolesError) throw rolesError;
      
      if (!rolesData || rolesData.length === 0) {
        setClinicUsers([]);
        return;
      }

      // Get profiles for those users
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

  const handleCreateProfessional = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = professionalSchema.safeParse({
      name: formName,
      specialty: formSpecialty || undefined,
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
      const { error } = await supabase
        .from('professionals')
        .insert({
          clinic_id: currentClinic.id,
          name: formName.trim(),
          specialty: formSpecialty.trim() || null,
          registration_number: formCRM.trim() || null,
          phone: formPhone.trim() || null,
          email: formEmail.trim() || null,
          user_id: formUserId || null,
        });

      if (error) throw error;

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
    setFormSpecialty("");
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

  const getScheduleSummary = (schedule: Json) => {
    if (!schedule || typeof schedule !== 'object') return "Não configurado";
    
    const scheduleObj = schedule as Record<string, { enabled: boolean; slots: { start: string; end: string }[] }>;
    const activeDays = Object.entries(scheduleObj)
      .filter(([_, day]) => day?.enabled)
      .length;
    
    if (activeDays === 0) return "Não configurado";
    return `${activeDays} dias/semana`;
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
              <div>
                <Label htmlFor="profSpecialty">Especialidade</Label>
                <Input
                  id="profSpecialty"
                  value={formSpecialty}
                  onChange={(e) => setFormSpecialty(e.target.value)}
                  placeholder="Clínico Geral"
                  className="mt-1.5"
                />
              </div>
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
                  <Select value={formUserId} onValueChange={setFormUserId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecione um usuário (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
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
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Ver agenda</DropdownMenuItem>
                      <DropdownMenuItem>Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openScheduleDialog(professional)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Configurar horários
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        Desativar
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
    </div>
  );
}
