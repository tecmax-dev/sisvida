import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { PatientHeader } from "@/components/patients/PatientHeader";
import { PatientTabs, PatientTab } from "@/components/patients/PatientTabs";
import { PatientFormFields, PatientFormData } from "@/components/patients/PatientFormFields";
import { useCepLookup } from "@/hooks/useCepLookup";
import { PatientRecordsModal } from "@/components/patients/modals/PatientRecordsModal";
import { PatientAnamnesisModal } from "@/components/patients/modals/PatientAnamnesisModal";
import { PatientPrescriptionModal } from "@/components/patients/modals/PatientPrescriptionModal";
import { PatientAppointmentsModal } from "@/components/patients/modals/PatientAppointmentsModal";
import { PatientCardsModal } from "@/components/patients/modals/PatientCardsModal";

interface InsurancePlan {
  id: string;
  name: string;
}

// Validação de CPF brasileiro
const isValidCPF = (cpf: string): boolean => {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) return false;
  
  return true;
};

const formatCPF = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  return cleaned
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .substring(0, 14);
};

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
});

const initialFormData: PatientFormData = {
  isCompany: false,
  isForeigner: false,
  recordCode: undefined,
  name: '',
  contactName: '',
  cpf: '',
  rg: '',
  gender: '',
  birthDate: '',
  birthplace: '',
  maritalStatus: '',
  insurancePlanId: '',
  heightCm: '',
  weightKg: '',
  skinColor: '',
  priority: 'none',
  religion: '',
  cep: '',
  street: '',
  streetNumber: '',
  neighborhood: '',
  city: '',
  state: '',
  complement: '',
  tag: '',
  referral: '',
  sendNotifications: true,
  phone: '',
  landline: '',
  email: '',
  preferredChannel: 'whatsapp',
  profession: '',
  education: '',
  motherName: '',
  fatherName: '',
  notes: '',
};

export default function PatientEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentClinic } = useAuth();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const { lookupCep, loading: cepLoading } = useCepLookup();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [insurancePlans, setInsurancePlans] = useState<InsurancePlan[]>([]);
  const [activeTab, setActiveTab] = useState<PatientTab>('cadastro');
  const [formData, setFormData] = useState<PatientFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [insurancePlanName, setInsurancePlanName] = useState<string>('');
  
  // Modal states
  const [recordsModalOpen, setRecordsModalOpen] = useState(false);
  const [anamnesisModalOpen, setAnamnesisModalOpen] = useState(false);
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const [appointmentsModalOpen, setAppointmentsModalOpen] = useState(false);
  const [cardsModalOpen, setCardsModalOpen] = useState(false);

  // Permission checks for restricted tabs
  const canViewMedicalRecords = hasPermission('view_medical_records');
  const canViewPrescriptions = hasPermission('view_prescriptions');
  
  // Determine which tabs to hide based on permissions
  const hiddenTabs: PatientTab[] = [];
  if (!canViewMedicalRecords) {
    hiddenTabs.push('prontuario', 'anexos');
  }
  if (!canViewPrescriptions) {
    hiddenTabs.push('prescricoes');
  }

  useEffect(() => {
    if (currentClinic && id) {
      fetchPatient();
      fetchInsurancePlans();
    }
  }, [currentClinic, id]);

  const fetchPatient = async () => {
    if (!currentClinic || !id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*, insurance_plans(name)')
        .eq('id', id)
        .eq('clinic_id', currentClinic.id)
        .single();

      if (error) throw error;
      
      if (data) {
        setFormData({
          isCompany: data.is_company || false,
          isForeigner: data.is_foreigner || false,
          recordCode: data.record_code,
          name: data.name || '',
          contactName: data.contact_name || '',
          cpf: data.cpf ? formatCPF(data.cpf) : '',
          rg: data.rg || '',
          gender: data.gender || '',
          birthDate: data.birth_date || '',
          birthplace: data.birthplace || '',
          maritalStatus: data.marital_status || '',
          insurancePlanId: data.insurance_plan_id || '',
          heightCm: data.height_cm?.toString() || '',
          weightKg: data.weight_kg?.toString() || '',
          skinColor: data.skin_color || '',
          priority: data.priority || 'none',
          religion: data.religion || '',
          cep: data.cep || '',
          street: data.street || '',
          streetNumber: data.street_number || '',
          neighborhood: data.neighborhood || '',
          city: data.city || '',
          state: data.state || '',
          complement: data.complement || '',
          tag: data.tag || '',
          referral: data.referral || '',
          sendNotifications: data.send_notifications ?? true,
          phone: data.phone ? formatPhone(data.phone) : '',
          landline: data.landline ? formatPhone(data.landline) : '',
          email: data.email || '',
          preferredChannel: data.preferred_channel || 'whatsapp',
          profession: data.profession || '',
          education: data.education || '',
          motherName: data.mother_name || '',
          fatherName: data.father_name || '',
          notes: data.notes || '',
        });
        
        if (data.insurance_plans) {
          setInsurancePlanName((data.insurance_plans as any).name || '');
        }
      }
    } catch (error) {
      console.error("Error fetching patient:", error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar os dados do paciente.",
        variant: "destructive",
      });
      navigate('/dashboard/patients');
    } finally {
      setLoading(false);
    }
  };

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

  const handleCepLookup = async () => {
    const cepData = await lookupCep(formData.cep);
    if (cepData) {
      setFormData(prev => ({
        ...prev,
        street: cepData.logradouro || prev.street,
        neighborhood: cepData.bairro || prev.neighborhood,
        city: cepData.localidade || prev.city,
        state: cepData.uf || prev.state,
        complement: cepData.complemento || prev.complement,
      }));
    }
  };

  const handleTabChange = (tab: PatientTab) => {
    if (tab === 'cadastro') {
      setActiveTab(tab);
    } else if (tab === 'prontuario') {
      setRecordsModalOpen(true);
    } else if (tab === 'anamnese') {
      setAnamnesisModalOpen(true);
    } else if (tab === 'anexos') {
      navigate(`/dashboard/patients/${id}/attachments`);
    } else if (tab === 'agendamentos') {
      setAppointmentsModalOpen(true);
    } else if (tab === 'prescricoes') {
      setPrescriptionModalOpen(true);
    } else if (tab === 'carteirinha') {
      setCardsModalOpen(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = patientSchema.safeParse({
      name: formData.name,
      phone: formData.phone,
      email: formData.email || undefined,
      cpf: formData.cpf || undefined,
    });
    
    if (!validation.success) {
      const newErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        newErrors[field] = err.message;
      });
      setErrors(newErrors);
      return;
    }

    if (!currentClinic || !id) return;

    setSaving(true);
    setErrors({});

    try {
      const { error } = await supabase
        .from('patients')
        .update({
          name: formData.name.trim(),
          phone: formData.phone.replace(/\D/g, '').trim(),
          email: formData.email.trim() || null,
          cpf: formData.cpf.replace(/\D/g, '').trim() || null,
          birth_date: formData.birthDate || null,
          notes: formData.notes.trim() || null,
          insurance_plan_id: formData.insurancePlanId || null,
          // New fields
          is_company: formData.isCompany,
          is_foreigner: formData.isForeigner,
          contact_name: formData.contactName.trim() || null,
          rg: formData.rg.trim() || null,
          gender: formData.gender || null,
          birthplace: formData.birthplace.trim() || null,
          marital_status: formData.maritalStatus || null,
          height_cm: formData.heightCm ? parseFloat(formData.heightCm) : null,
          weight_kg: formData.weightKg ? parseFloat(formData.weightKg) : null,
          skin_color: formData.skinColor || null,
          priority: formData.priority || 'none',
          religion: formData.religion.trim() || null,
          cep: formData.cep.replace(/\D/g, '').trim() || null,
          street: formData.street.trim() || null,
          street_number: formData.streetNumber.trim() || null,
          neighborhood: formData.neighborhood.trim() || null,
          city: formData.city.trim() || null,
          state: formData.state || null,
          complement: formData.complement.trim() || null,
          tag: formData.tag.trim() || null,
          referral: formData.referral.trim() || null,
          send_notifications: formData.sendNotifications,
          landline: formData.landline.replace(/\D/g, '').trim() || null,
          preferred_channel: formData.preferredChannel || 'whatsapp',
          profession: formData.profession.trim() || null,
          education: formData.education || null,
          mother_name: formData.motherName.trim() || null,
          father_name: formData.fatherName.trim() || null,
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Paciente atualizado",
        description: "As informações foram salvas com sucesso.",
      });

      navigate('/dashboard/patients');
    } catch (error: any) {
      if (error.message?.includes('CPF_DUPLICADO') || error.message?.includes('idx_patients_cpf_clinic')) {
        setErrors({ cpf: "Este CPF já está cadastrado no sistema." });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!formData.name) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Paciente não encontrado.</p>
        <Button variant="outline" onClick={() => navigate('/dashboard/patients')} className="mt-4">
          Voltar para lista
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar with back button */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/patients')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>

      {/* Patient Header */}
      <PatientHeader
        name={formData.name}
        recordCode={formData.recordCode}
        birthDate={formData.birthDate}
        phone={formData.phone}
        insurancePlan={insurancePlanName}
        priority={formData.priority}
      />

      {/* Tabs Navigation */}
      <PatientTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        patientId={id || ''}
        hiddenTabs={hiddenTabs}
      />

      {/* Tab Content */}
      {activeTab === 'cadastro' && (
        <div className="bg-card rounded-lg border p-6">
          <form onSubmit={handleSubmit}>
            <PatientFormFields
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              insurancePlans={insurancePlans}
              onCepLookup={handleCepLookup}
              cepLoading={cepLoading}
            />
          </form>
        </div>
      )}

      {/* Modals */}
      <PatientRecordsModal
        open={recordsModalOpen}
        onOpenChange={setRecordsModalOpen}
        patientId={id || ''}
        patientName={formData.name}
      />

      <PatientAnamnesisModal
        open={anamnesisModalOpen}
        onOpenChange={setAnamnesisModalOpen}
        patientId={id || ''}
        patientName={formData.name}
      />

      <PatientPrescriptionModal
        open={prescriptionModalOpen}
        onOpenChange={setPrescriptionModalOpen}
        patientId={id || ''}
        patientName={formData.name}
      />

      <PatientAppointmentsModal
        open={appointmentsModalOpen}
        onOpenChange={setAppointmentsModalOpen}
        patientId={id || ''}
        patientName={formData.name}
      />

      <PatientCardsModal
        open={cardsModalOpen}
        onOpenChange={setCardsModalOpen}
        patientId={id || ''}
        patientName={formData.name}
      />
    </div>
  );
}