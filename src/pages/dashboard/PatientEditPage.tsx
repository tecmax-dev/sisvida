import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Save, Check, Cloud, UserX, UserCheck } from "lucide-react";
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
import { DependentsPanel } from "@/components/patients/DependentsPanel";
import { PatientSearchBox } from "@/components/patients/PatientSearchBox";

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
  const [searchParams] = useSearchParams();
  const { currentClinic } = useAuth();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const { lookupCep, loading: cepLoading } = useCepLookup();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [insurancePlans, setInsurancePlans] = useState<InsurancePlan[]>([]);
  const [activeTab, setActiveTab] = useState<PatientTab>('cadastro');
  const [formData, setFormData] = useState<PatientFormData>(initialFormData);
  const [initialData, setInitialData] = useState<PatientFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [insurancePlanName, setInsurancePlanName] = useState<string>('');
  const [showDependentsForm, setShowDependentsForm] = useState(false);
  
  // Auto-save refs
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);
  
  // No-show blocking state
  const [noShowBlockedUntil, setNoShowBlockedUntil] = useState<string | null>(null);
  const [noShowBlockedAt, setNoShowBlockedAt] = useState<string | null>(null);
  const [noShowUnblockedAt, setNoShowUnblockedAt] = useState<string | null>(null);
  
  // Patient active state
  const [isPatientActive, setIsPatientActive] = useState(true);
  const [togglingActive, setTogglingActive] = useState(false);
  
  // Modal states
  const [recordsModalOpen, setRecordsModalOpen] = useState(false);
  const [anamnesisModalOpen, setAnamnesisModalOpen] = useState(false);
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const [appointmentsModalOpen, setAppointmentsModalOpen] = useState(false);
  const [cardsModalOpen, setCardsModalOpen] = useState(false);

  // Permission checks for restricted tabs
  const canViewMedicalRecords = hasPermission('view_medical_records');
  const canViewPrescriptions = hasPermission('view_prescriptions');
  const isAdmin = hasPermission('manage_patients');
  
  // Determine which tabs to hide based on permissions
  const hiddenTabs: PatientTab[] = [];
  if (!canViewMedicalRecords) {
    hiddenTabs.push('prontuario', 'anexos');
  }
  if (!canViewPrescriptions) {
    hiddenTabs.push('prescricoes');
  }
  // Odontograma visible only for admins
  if (!isAdmin) {
    hiddenTabs.push('odontograma');
  }

  // Check URL params for dependentes action
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const dependentesParam = searchParams.get('dependentes');
    
    if (tabParam === 'cadastro' && dependentesParam === 'true') {
      setActiveTab('cadastro');
      setShowDependentsForm(true);
    }
  }, [searchParams]);

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
        const loadedData: PatientFormData = {
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
        };
        setFormData(loadedData);
        setInitialData(loadedData);
        hasLoadedRef.current = true;
        
        // Set no-show blocking data
        setNoShowBlockedUntil(data.no_show_blocked_until);
        setNoShowBlockedAt(data.no_show_blocked_at);
        setNoShowUnblockedAt(data.no_show_unblocked_at);
        
        // Set active state
        setIsPatientActive(data.is_active ?? true);
        
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

  // Auto-save function
  const performAutoSave = useCallback(async (dataToSave: PatientFormData) => {
    if (!currentClinic || !id || !hasLoadedRef.current) return;
    
    // Validate before saving
    const validation = patientSchema.safeParse({
      name: dataToSave.name,
      phone: dataToSave.phone,
      email: dataToSave.email || undefined,
      cpf: dataToSave.cpf || undefined,
    });
    
    if (!validation.success) return; // Don't auto-save invalid data

    setAutoSaveStatus('saving');
    
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          name: dataToSave.name.trim(),
          phone: dataToSave.phone.replace(/\D/g, '').trim(),
          email: dataToSave.email.trim() || null,
          cpf: dataToSave.cpf.replace(/\D/g, '').trim() || null,
          birth_date: dataToSave.birthDate || null,
          notes: dataToSave.notes.trim() || null,
          insurance_plan_id: dataToSave.insurancePlanId || null,
          is_company: dataToSave.isCompany,
          is_foreigner: dataToSave.isForeigner,
          contact_name: dataToSave.contactName.trim() || null,
          rg: dataToSave.rg.trim() || null,
          gender: dataToSave.gender || null,
          birthplace: dataToSave.birthplace.trim() || null,
          marital_status: dataToSave.maritalStatus || null,
          height_cm: dataToSave.heightCm ? parseFloat(dataToSave.heightCm) : null,
          weight_kg: dataToSave.weightKg ? parseFloat(dataToSave.weightKg) : null,
          skin_color: dataToSave.skinColor || null,
          priority: dataToSave.priority || 'none',
          religion: dataToSave.religion.trim() || null,
          cep: dataToSave.cep.replace(/\D/g, '').trim() || null,
          street: dataToSave.street.trim() || null,
          street_number: dataToSave.streetNumber.trim() || null,
          neighborhood: dataToSave.neighborhood.trim() || null,
          city: dataToSave.city.trim() || null,
          state: dataToSave.state || null,
          complement: dataToSave.complement.trim() || null,
          tag: dataToSave.tag.trim() || null,
          referral: dataToSave.referral.trim() || null,
          send_notifications: dataToSave.sendNotifications,
          landline: dataToSave.landline.replace(/\D/g, '').trim() || null,
          preferred_channel: dataToSave.preferredChannel || 'whatsapp',
          profession: dataToSave.profession.trim() || null,
          education: dataToSave.education || null,
          mother_name: dataToSave.motherName.trim() || null,
          father_name: dataToSave.fatherName.trim() || null,
        })
        .eq('id', id);

      if (error) throw error;
      
      setAutoSaveStatus('saved');
      setInitialData(dataToSave);
      
      // Reset status after 2 seconds
      setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error("Auto-save error:", error);
      setAutoSaveStatus('idle');
    }
  }, [currentClinic, id]);

  // Check if form data has changed
  const hasFormChanged = useCallback((current: PatientFormData, initial: PatientFormData): boolean => {
    return JSON.stringify(current) !== JSON.stringify(initial);
  }, []);

  // Auto-save effect with debounce
  useEffect(() => {
    if (!hasLoadedRef.current || !hasFormChanged(formData, initialData)) return;
    
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      performAutoSave(formData);
    }, 3000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formData, initialData, performAutoSave, hasFormChanged]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

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
    } else if (tab === 'odontograma') {
      navigate(`/dashboard/patients/${id}/odontograma`);
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

  const handleUnblockNoShow = async () => {
    if (!id || !currentClinic) return;
    
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          no_show_unblocked_by: (await supabase.auth.getUser()).data.user?.id,
          no_show_unblocked_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('clinic_id', currentClinic.id);

      if (error) throw error;

      setNoShowUnblockedAt(new Date().toISOString());
      
      toast({
        title: "Bloqueio liberado",
        description: "O paciente agora pode agendar consultas novamente.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao liberar",
        description: error.message || "Não foi possível liberar o bloqueio.",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async () => {
    if (!id || !currentClinic) return;
    
    setTogglingActive(true);
    try {
      const newActiveState = !isPatientActive;
      const { error } = await supabase
        .from('patients')
        .update({ is_active: newActiveState })
        .eq('id', id)
        .eq('clinic_id', currentClinic.id);

      if (error) throw error;

      // Also update all dependents when inactivating
      if (!newActiveState) {
        await supabase
          .from('patient_dependents')
          .update({ is_active: false })
          .eq('patient_id', id)
          .eq('clinic_id', currentClinic.id);
      }

      setIsPatientActive(newActiveState);
      
      toast({
        title: newActiveState ? "Paciente ativado" : "Paciente inativado",
        description: newActiveState 
          ? "O paciente foi reativado com sucesso."
          : "O paciente e seus dependentes foram inativados.",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível alterar o status.",
        variant: "destructive",
      });
    } finally {
      setTogglingActive(false);
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
      {/* Top bar with back button, search box and auto-save indicator */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/patients')} className="gap-2 flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        
        {/* Search box */}
        <div className="flex-1 max-w-sm hidden md:block">
          <PatientSearchBox />
        </div>
        
        <div className="flex items-center gap-3">
          {/* Auto-save status indicator */}
          {autoSaveStatus === 'saving' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Cloud className="h-4 w-4 animate-pulse" />
              <span className="hidden sm:inline">Salvando...</span>
            </div>
          )}
          {autoSaveStatus === 'saved' && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="h-4 w-4" />
              <span className="hidden sm:inline">Salvo</span>
            </div>
          )}
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar e Voltar
          </Button>
        </div>
      </div>
      
      {/* Mobile search box */}
      <div className="block md:hidden">
        <PatientSearchBox />
      </div>

      {/* Inactive Patient Alert */}
      {!isPatientActive && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserX className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Paciente Inativo</p>
              <p className="text-sm text-muted-foreground">Este paciente está inativo e não aparece nas listagens padrão.</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleToggleActive}
            disabled={togglingActive}
            className="gap-2"
          >
            {togglingActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            Reativar
          </Button>
        </div>
      )}

      {/* Patient Header */}
      <PatientHeader
        name={formData.name}
        recordCode={formData.recordCode}
        birthDate={formData.birthDate}
        phone={formData.phone}
        insurancePlan={insurancePlanName}
        priority={formData.priority}
        noShowBlockedUntil={noShowBlockedUntil}
        noShowBlockedAt={noShowBlockedAt}
        noShowUnblockedAt={noShowUnblockedAt}
        onUnblockNoShow={handleUnblockNoShow}
        isAdmin={isAdmin}
        isActive={isPatientActive}
        onToggleActive={handleToggleActive}
        togglingActive={togglingActive}
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
        <div className="space-y-6">
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

          {/* Painel de Dependentes */}
          {id && currentClinic && (
            <div className="bg-card rounded-lg border p-6">
              <DependentsPanel
                patientId={id}
                clinicId={currentClinic.id}
                patientPhone={formData.phone}
                autoOpenForm={showDependentsForm}
              />
            </div>
          )}
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