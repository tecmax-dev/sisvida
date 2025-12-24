import { useEffect, useState, useCallback } from "react";
import { 
  Search, 
  Plus, 
  Phone, 
  Mail,
  MoreVertical,
  Calendar,
  Loader2,
  User,
  MapPin,
  CreditCard,
  FileText,
  MessageCircle,
  Paperclip,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculateAge } from "@/lib/utils";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { RealtimeIndicator } from "@/components/ui/realtime-indicator";

interface Patient {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  cpf: string | null;
  address: string | null;
  birth_date: string | null;
  notes: string | null;
  insurance_plan_id: string | null;
  insurance_plan?: {
    name: string;
  } | null;
  created_at: string;
}

interface InsurancePlan {
  id: string;
  name: string;
}

// Validação de CPF brasileiro
const isValidCPF = (cpf: string): boolean => {
  const cleaned = cpf.replace(/\D/g, '');
  
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false; // CPFs com todos dígitos iguais
  
  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;
  
  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) return false;
  
  return true;
};

// Formatação de CPF: 000.000.000-00
const formatCPF = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  return cleaned
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .substring(0, 14);
};

// Formatação de telefone: (00) 00000-0000
const formatPhone = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  return cleaned
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .substring(0, 15);
};

const patientSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(100),
  phone: z.string().min(10, "Telefone inválido").max(20),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  cpf: z.string()
    .optional()
    .or(z.literal(""))
    .refine((val) => !val || val.replace(/\D/g, '').length === 0 || isValidCPF(val), {
      message: "CPF inválido"
    }),
  birth_date: z.string().optional().or(z.literal("")),
  address: z.string().max(200, "Endereço deve ter no máximo 200 caracteres").optional().or(z.literal("")),
  insurance_plan_id: z.string().optional().or(z.literal("")),
  notes: z.string().max(500, "Observações deve ter no máximo 500 caracteres").optional().or(z.literal("")),
});

export default function PatientsPage() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [insurancePlans, setInsurancePlans] = useState<InsurancePlan[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Selected patient for actions
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  
  // Dialog states
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [anamnesisDialogOpen, setAnamnesisDialogOpen] = useState(false);
  const [anamnesisTemplates, setAnamnesisTemplates] = useState<{ id: string; title: string }[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [sendingAnamnesis, setSendingAnamnesis] = useState(false);
  
  // Form state for create
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCpf, setFormCpf] = useState("");
  const [formBirthDate, setFormBirthDate] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formInsurancePlanId, setFormInsurancePlanId] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formErrors, setFormErrors] = useState<{ name?: string; phone?: string; email?: string; cpf?: string; address?: string; notes?: string }>({});

  // Form state for edit
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editInsurancePlanId, setEditInsurancePlanId] = useState("");
  const [editErrors, setEditErrors] = useState<{ name?: string; phone?: string; email?: string; cpf?: string; address?: string; notes?: string }>({});

  const fetchPatients = useCallback(async () => {
    if (!currentClinic) return;
    
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('patients')
        .select(`
          id,
          name,
          email,
          phone,
          cpf,
          address,
          birth_date,
          notes,
          insurance_plan_id,
          created_at,
          insurance_plan:insurance_plans (
            name
          )
        `)
        .eq('clinic_id', currentClinic.id)
        .order('name');

      if (error) throw error;
      setPatients(data as Patient[]);
    } catch (error) {
      console.error("Error fetching patients:", error);
    } finally {
      setLoading(false);
    }
  }, [currentClinic]);

  useEffect(() => {
    if (currentClinic) {
      fetchPatients();
      fetchInsurancePlans();
    }
  }, [currentClinic, fetchPatients]);

  // Realtime subscription for automatic updates
  useRealtimeSubscription({
    table: "patients",
    filter: currentClinic ? { column: "clinic_id", value: currentClinic.id } : undefined,
    onInsert: () => fetchPatients(),
    onUpdate: () => fetchPatients(),
    onDelete: () => fetchPatients(),
    enabled: !!currentClinic,
  });

  const fetchInsurancePlans = async () => {
    if (!currentClinic) return;
    
    try {
      const { data, error } = await supabase
        .from('insurance_plans')
        .select('id, name')
        .eq('clinic_id', currentClinic.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setInsurancePlans(data || []);
    } catch (error) {
      console.error("Error fetching insurance plans:", error);
    }
  };

  const fetchAnamnesisTemplates = async () => {
    if (!currentClinic) return;
    const { data } = await supabase
      .from('anamnese_templates')
      .select('id, title')
      .eq('clinic_id', currentClinic.id)
      .eq('is_active', true)
      .order('title');
    setAnamnesisTemplates(data || []);
  };

  const handleSendAnamnesisLink = async () => {
    if (!selectedPatient || !selectedTemplateId || !currentClinic) return;
    
    setSendingAnamnesis(true);
    try {
      // Create anamnese response with public token
      const { data: response, error } = await supabase
        .from('anamnese_responses')
        .insert({
          clinic_id: currentClinic.id,
          patient_id: selectedPatient.id,
          template_id: selectedTemplateId,
        })
        .select('public_token')
        .single();

      if (error) throw error;

      const anamnesisUrl = `${window.location.origin}/anamnese/${response.public_token}`;
      const message = `Olá ${selectedPatient.name}! 👋\n\nPor favor, preencha seu formulário de anamnese através do link abaixo:\n\n${anamnesisUrl}\n\nAtenciosamente,\n${currentClinic.name}`;

      await sendWhatsAppMessage({
        phone: selectedPatient.phone,
        message,
        clinicId: currentClinic.id,
        type: 'custom',
      });

      toast({ title: "Link enviado!", description: "A anamnese foi enviada via WhatsApp." });
      setAnamnesisDialogOpen(false);
      setSelectedTemplateId("");
    } catch (error: any) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally {
      setSendingAnamnesis(false);
    }
  };

  const openAnamnesisDialog = (patient: Patient) => {
    setSelectedPatient(patient);
    fetchAnamnesisTemplates();
    setAnamnesisDialogOpen(true);
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = patientSchema.safeParse({
      name: formName,
      phone: formPhone,
      email: formEmail || undefined,
      cpf: formCpf || undefined,
      birth_date: formBirthDate || undefined,
      address: formAddress || undefined,
      insurance_plan_id: formInsurancePlanId || undefined,
      notes: formNotes || undefined,
    });
    
    if (!validation.success) {
      const errors: typeof formErrors = {};
      validation.error.errors.forEach((err) => {
        const field = err.path[0] as keyof typeof errors;
        errors[field] = err.message;
      });
      setFormErrors(errors);
      return;
    }

    if (!currentClinic) return;

    setSaving(true);
    setFormErrors({});

    try {
      const { error } = await supabase
        .from('patients')
        .insert({
          clinic_id: currentClinic.id,
          name: formName.trim(),
          phone: formPhone.replace(/\D/g, '').trim(),
          email: formEmail.trim() || null,
          cpf: formCpf.replace(/\D/g, '').trim() || null,
          birth_date: formBirthDate || null,
          address: formAddress.trim() || null,
          insurance_plan_id: formInsurancePlanId || null,
          notes: formNotes.trim() || null,
        });

      if (error) throw error;

      toast({
        title: "Paciente cadastrado",
        description: "O paciente foi adicionado com sucesso.",
      });

      setDialogOpen(false);
      setFormName("");
      setFormPhone("");
      setFormEmail("");
      setFormCpf("");
      setFormBirthDate("");
      setFormAddress("");
      setFormInsurancePlanId("");
      setFormNotes("");
      fetchPatients();
    } catch (error: any) {
      if (error.message?.includes('CPF_DUPLICADO') || error.message?.includes('idx_patients_cpf_clinic')) {
        setFormErrors({ cpf: "Este CPF já está cadastrado no sistema." });
        toast({
          title: "CPF duplicado",
          description: "Este CPF já está cadastrado no sistema.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao cadastrar",
          description: error.message || "Tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleViewProfile = (patient: Patient) => {
    setSelectedPatient(patient);
    setProfileDialogOpen(true);
  };

  const handleScheduleAppointment = (patient: Patient) => {
    // Navigate to calendar page with patient pre-selected
    navigate(`/dashboard/calendar?patient=${patient.id}`);
  };

  const handleOpenEdit = (patient: Patient) => {
    navigate(`/dashboard/patients/${patient.id}/edit`);
  };

  const handleEditPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !currentClinic) return;

    const validation = patientSchema.safeParse({
      name: editName,
      phone: editPhone,
      email: editEmail || undefined,
      cpf: editCpf || undefined,
      birth_date: editBirthDate || undefined,
      address: editAddress || undefined,
      insurance_plan_id: editInsurancePlanId || undefined,
      notes: editNotes || undefined,
    });
    
    if (!validation.success) {
      const errors: typeof editErrors = {};
      validation.error.errors.forEach((err) => {
        const field = err.path[0] as keyof typeof errors;
        errors[field] = err.message;
      });
      setEditErrors(errors);
      return;
    }

    setSaving(true);
    setEditErrors({});

    try {
      const { error } = await supabase
        .from('patients')
        .update({
          name: editName.trim(),
          phone: editPhone.replace(/\D/g, '').trim(),
          email: editEmail.trim() || null,
          cpf: editCpf.replace(/\D/g, '').trim() || null,
          address: editAddress.trim() || null,
          birth_date: editBirthDate || null,
          notes: editNotes.trim() || null,
          insurance_plan_id: editInsurancePlanId || null,
        })
        .eq('id', selectedPatient.id);

      if (error) throw error;

      toast({
        title: "Paciente atualizado",
        description: "As informações foram salvas com sucesso.",
      });

      setEditDialogOpen(false);
      fetchPatients();
    } catch (error: any) {
      if (error.message?.includes('CPF_DUPLICADO') || error.message?.includes('idx_patients_cpf_clinic')) {
        setEditErrors({ cpf: "Este CPF já está cadastrado no sistema." });
        toast({
          title: "CPF duplicado",
          description: "Este CPF já está cadastrado no sistema.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao atualizar",
          description: error.message || "Tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (patient: Patient) => {
    setSelectedPatient(patient);
    setDeleteDialogOpen(true);
  };

  const handleDeletePatient = async () => {
    if (!selectedPatient) return;

    setSaving(true);

    try {
      // Check for scheduled appointments
      const { data: appointments, error: checkError } = await supabase
        .from('appointments')
        .select('id')
        .eq('patient_id', selectedPatient.id)
        .in('status', ['scheduled', 'confirmed'])
        .limit(1);

      if (checkError) throw checkError;

      if (appointments && appointments.length > 0) {
        toast({
          title: "Não é possível excluir",
          description: "Este paciente possui consultas agendadas. Cancele as consultas antes de excluir.",
          variant: "destructive",
        });
        setSaving(false);
        setDeleteDialogOpen(false);
        return;
      }

      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', selectedPatient.id);

      if (error) throw error;

      toast({
        title: "Paciente excluído",
        description: "O paciente foi removido com sucesso.",
      });

      setDeleteDialogOpen(false);
      fetchPatients();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredPatients = patients.filter(
    (patient) =>
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (patient.email && patient.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      patient.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pacientes</h1>
          <p className="text-muted-foreground">
            Gerencie o cadastro dos seus pacientes
          </p>
          <RealtimeIndicator className="mt-2" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <Plus className="h-4 w-4 mr-2" />
              Novo Paciente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar Paciente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreatePatient} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="patientName">Nome *</Label>
                  <Input
                    id="patientName"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Nome completo"
                    className={`mt-1.5 ${formErrors.name ? "border-destructive" : ""}`}
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-destructive">{formErrors.name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="patientPhone">Telefone *</Label>
                  <Input
                    id="patientPhone"
                    value={formPhone}
                    onChange={(e) => setFormPhone(formatPhone(e.target.value))}
                    placeholder="(11) 99999-9999"
                    className={`mt-1.5 ${formErrors.phone ? "border-destructive" : ""}`}
                  />
                  {formErrors.phone && (
                    <p className="mt-1 text-sm text-destructive">{formErrors.phone}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="patientCpf">CPF</Label>
                  <Input
                    id="patientCpf"
                    value={formCpf}
                    onChange={(e) => setFormCpf(formatCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    className={`mt-1.5 ${formErrors.cpf ? "border-destructive" : ""}`}
                  />
                  {formErrors.cpf && (
                    <p className="mt-1 text-sm text-destructive">{formErrors.cpf}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="patientEmail">Email</Label>
                  <Input
                    id="patientEmail"
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className={`mt-1.5 ${formErrors.email ? "border-destructive" : ""}`}
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-sm text-destructive">{formErrors.email}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="patientBirthDate">Data de Nascimento</Label>
                  <Input
                    id="patientBirthDate"
                    type="date"
                    value={formBirthDate}
                    onChange={(e) => setFormBirthDate(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="patientAddress">Endereço</Label>
                  <Input
                    id="patientAddress"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Rua, número, bairro, cidade"
                    className={`mt-1.5 ${formErrors.address ? "border-destructive" : ""}`}
                  />
                  {formErrors.address && (
                    <p className="mt-1 text-sm text-destructive">{formErrors.address}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="patientInsurance">Plano de Saúde</Label>
                  <Select value={formInsurancePlanId || "none"} onValueChange={(val) => setFormInsurancePlanId(val === "none" ? "" : val)}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecione (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {insurancePlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="patientNotes">Observações</Label>
                  <Textarea
                    id="patientNotes"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Informações adicionais sobre o paciente"
                    className={`mt-1.5 ${formErrors.notes ? "border-destructive" : ""}`}
                    rows={3}
                  />
                  {formErrors.notes && (
                    <p className="mt-1 text-sm text-destructive">{formErrors.notes}</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
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

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Patients List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {filteredPatients.length} paciente{filteredPatients.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              Carregando pacientes...
            </div>
          ) : filteredPatients.length > 0 ? (
            <div className="space-y-3">
              {filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-lg font-semibold text-primary">
                      {patient.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{patient.name}</p>
                      {patient.birth_date && (
                        <Badge variant="outline" className="text-xs">
                          {calculateAge(patient.birth_date)} anos
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      {patient.email && (
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {patient.email}
                        </span>
                      )}
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {patient.phone}
                      </span>
                    </div>
                  </div>

                  {patient.insurance_plan && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium">
                      {patient.insurance_plan.name}
                    </span>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => handleViewProfile(patient)}>
                        <User className="h-4 w-4 mr-2" />
                        Ver perfil
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleScheduleAppointment(patient)}>
                        <Calendar className="h-4 w-4 mr-2" />
                        Agendar consulta
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenEdit(patient)}>
                        <FileText className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openAnamnesisDialog(patient)}>
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Enviar Anamnese
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/dashboard/patients/${patient.id}/attachments`)}>
                        <Paperclip className="h-4 w-4 mr-2" />
                        Anexos
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleOpenDelete(patient)}
                      >
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-4">Nenhum paciente encontrado</p>
              <Button variant="outline" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar paciente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Perfil do Paciente</DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-semibold text-primary">
                    {selectedPatient.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedPatient.name}</h3>
                  {selectedPatient.insurance_plan && (
                    <span className="text-sm text-muted-foreground">
                      {selectedPatient.insurance_plan.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedPatient.phone}</span>
                </div>
                {selectedPatient.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedPatient.email}</span>
                  </div>
                )}
                {selectedPatient.cpf && (
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span>CPF: {selectedPatient.cpf}</span>
                  </div>
                )}
                {selectedPatient.birth_date && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Nascimento: {format(new Date(selectedPatient.birth_date + "T12:00:00"), "dd/MM/yyyy")}</span>
                  </div>
                )}
                {selectedPatient.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedPatient.address}</span>
                  </div>
                )}
              </div>

              {selectedPatient.notes && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Observações:</p>
                  <p className="text-sm">{selectedPatient.notes}</p>
                </div>
              )}

              <div className="pt-4 border-t text-xs text-muted-foreground">
                Cadastrado em: {format(new Date(selectedPatient.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setProfileDialogOpen(false);
                    handleOpenEdit(selectedPatient);
                  }}
                >
                  Editar
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => {
                    setProfileDialogOpen(false);
                    handleScheduleAppointment(selectedPatient);
                  }}
                >
                  Agendar consulta
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Paciente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditPatient} className="space-y-4">
            <div>
              <Label htmlFor="editName">Nome *</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={`mt-1.5 ${editErrors.name ? "border-destructive" : ""}`}
              />
              {editErrors.name && (
                <p className="mt-1 text-sm text-destructive">{editErrors.name}</p>
              )}
            </div>
            <div>
              <Label htmlFor="editPhone">Telefone *</Label>
              <Input
                id="editPhone"
                value={editPhone}
                onChange={(e) => setEditPhone(formatPhone(e.target.value))}
                className={`mt-1.5 ${editErrors.phone ? "border-destructive" : ""}`}
              />
              {editErrors.phone && (
                <p className="mt-1 text-sm text-destructive">{editErrors.phone}</p>
              )}
            </div>
            <div>
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className={`mt-1.5 ${editErrors.email ? "border-destructive" : ""}`}
              />
            </div>
            <div>
              <Label htmlFor="editCpf">CPF</Label>
              <Input
                id="editCpf"
                value={editCpf}
                onChange={(e) => setEditCpf(formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                className={`mt-1.5 ${editErrors.cpf ? "border-destructive" : ""}`}
              />
              {editErrors.cpf && (
                <p className="mt-1 text-sm text-destructive">{editErrors.cpf}</p>
              )}
            </div>
            <div>
              <Label htmlFor="editBirthDate">Data de Nascimento</Label>
              <Input
                id="editBirthDate"
                type="date"
                value={editBirthDate}
                onChange={(e) => setEditBirthDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="editAddress">Endereço</Label>
              <Input
                id="editAddress"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="editInsurance">Plano de Saúde</Label>
              <Select value={editInsurancePlanId || "none"} onValueChange={(val) => setEditInsurancePlanId(val === "none" ? "" : val)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {insurancePlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editNotes">Observações</Label>
              <Textarea
                id="editNotes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="mt-1.5"
                rows={3}
              />
            </div>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir paciente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selectedPatient?.name}</strong>? 
              Esta ação não pode ser desfeita e todos os dados do paciente serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePatient}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Anamnesis Dialog */}
      <Dialog open={anamnesisDialogOpen} onOpenChange={setAnamnesisDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Anamnese via WhatsApp</DialogTitle>
            <DialogDescription>
              Selecione o modelo de anamnese para enviar ao paciente {selectedPatient?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Modelo de Anamnese</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {anamnesisTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAnamnesisDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSendAnamnesisLink} disabled={!selectedTemplateId || sendingAnamnesis}>
                {sendingAnamnesis && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <MessageCircle className="mr-2 h-4 w-4" />
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
