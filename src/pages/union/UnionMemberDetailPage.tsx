import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, UserX, UserCheck, Users, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { useModal } from "@/contexts/ModalContext";
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveIndicator } from "@/components/ui/auto-save-indicator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCepLookup } from "@/hooks/useCepLookup";
import { useCnpjLookup } from "@/hooks/useCnpjLookup";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Components
import { UnionMemberTabs, UnionMemberTab } from "@/components/union/members/UnionMemberTabs";
import { PatientHeader } from "@/components/patients/PatientHeader";
import { PatientFormFields, PatientFormData } from "@/components/patients/PatientFormFields";
import { PatientPhotoUpload } from "@/components/patients/PatientPhotoUpload";
import { DependentsPanel } from "@/components/patients/DependentsPanel";
import { PatientCardsModal } from "@/components/patients/modals/PatientCardsModal";
import { PatientAppointmentsModal } from "@/components/patients/modals/PatientAppointmentsModal";
import { MemberFiliacaoShareCard } from "@/components/union/members/MemberFiliacaoShareCard";
import { UnionMemberSchedulingTab } from "@/components/union/members/UnionMemberSchedulingTab";

interface InsurancePlan {
  id: string;
  name: string;
}

interface Category {
  id: string;
  nome: string;
  valor_contribuicao: number;
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
  registrationNumber: undefined,
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
  employerCnpj: '',
  employerName: '',
  motherName: '',
  fatherName: '',
  notes: '',
  maxAppointmentsPerMonth: null,
  mobilePassword: '',
};

export default function UnionMemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentClinic, user } = useAuth();
  const { hasPermission, isAdmin } = usePermissions();
  const { canManageMembers } = useUnionPermissions();
  const { openModal, closeModal, isModalOpen, getModalData } = useModal();
  const { toast } = useToast();
  const { lookupCep, loading: cepLoading } = useCepLookup();
  const { lookupCnpj, cnpjLoading } = useCnpjLookup();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [insurancePlans, setInsurancePlans] = useState<InsurancePlan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<UnionMemberTab>('cadastro');
  const [formData, setFormData] = useState<PatientFormData>(initialFormData);
  const [initialData, setInitialData] = useState<PatientFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [insurancePlanName, setInsurancePlanName] = useState<string>('');
  const [showDependentsForm, setShowDependentsForm] = useState(false);
  const [clinicDefaultLimit, setClinicDefaultLimit] = useState<number | null>(null);

  // Union-specific fields
  const [unionStatus, setUnionStatus] = useState("pendente");
  const [unionCategoryId, setUnionCategoryId] = useState("");
  const [unionContribution, setUnionContribution] = useState("");
  const [unionPaymentMethod, setUnionPaymentMethod] = useState("");
  const [unionObservations, setUnionObservations] = useState("");
  const [unionJoinedAt, setUnionJoinedAt] = useState<string | null>(null);
  const [savingUnion, setSavingUnion] = useState(false);

  // Patient state
  const [isPatientActive, setIsPatientActive] = useState(true);
  const [togglingActive, setTogglingActive] = useState(false);
  const [patientPhotoUrl, setPatientPhotoUrl] = useState<string | null>(null);

  // Check URL params for dependentes action
  useEffect(() => {
    const tabParam = searchParams.get('tab') as UnionMemberTab | null;
    const dependentesParam = searchParams.get('dependentes');
    const editDependentParam = searchParams.get('editDependent');

    if (dependentesParam === 'true' || !!editDependentParam) {
      if (tabParam !== 'dependentes') {
        const next = new URLSearchParams(searchParams);
        next.set('tab', 'dependentes');
        navigate({ search: `?${next.toString()}` }, { replace: true });
      }
      setActiveTab('dependentes');
      setShowDependentsForm(true);
      return;
    }

    if (tabParam === 'cadastro' || tabParam === 'dependentes' || tabParam === 'sindical') {
      setActiveTab(tabParam);
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    if (currentClinic && id) {
      fetchMember();
      fetchInsurancePlans();
      fetchCategories();
      fetchClinicLimit();
    }
  }, [currentClinic, id]);

  const fetchClinicLimit = async () => {
    if (!currentClinic) return;
    try {
      const { data } = await supabase
        .from('clinics')
        .select('max_appointments_per_cpf_month')
        .eq('id', currentClinic.id)
        .single();
      setClinicDefaultLimit(data?.max_appointments_per_cpf_month ?? null);
    } catch (error) {
      console.error("Error fetching clinic limit:", error);
    }
  };

  const fetchMember = async () => {
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
          registrationNumber: (data as any).registration_number || undefined,
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
          employerCnpj: (data as any).employer_cnpj || '',
          employerName: (data as any).employer_name || '',
          motherName: data.mother_name || '',
          fatherName: data.father_name || '',
          notes: data.notes || '',
          maxAppointmentsPerMonth: (data as any).max_appointments_per_month ?? null,
        };
        setFormData(loadedData);
        setInitialData(loadedData);

        // Union specific data
        const effectiveStatus = data.union_member_status || data.tag?.toLowerCase() || "pendente";
        setUnionStatus(effectiveStatus);
        setUnionCategoryId(data.union_category_id || "");
        setUnionContribution(data.union_contribution_value?.toString() || "");
        setUnionPaymentMethod(data.union_payment_method || "");
        setUnionObservations(data.union_observations || "");
        setUnionJoinedAt(data.union_joined_at);

        setIsPatientActive(data.is_active ?? true);
        setPatientPhotoUrl(data.photo_url || null);

        if (data.insurance_plans) {
          setInsurancePlanName((data.insurance_plans as any).name || '');
        }
      }
    } catch (error) {
      console.error("Error fetching member:", error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar os dados do sócio.",
        variant: "destructive",
      });
      navigate('/union/socios');
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

  const fetchCategories = async () => {
    if (!currentClinic) return;
    const query = supabase
      .from("sindical_categorias" as "anamnese_templates")
      .select("id, nome, valor_contribuicao")
      .eq("sindicato_id" as "clinic_id", currentClinic.id)
      .eq("ativo" as "is_active", true)
      .order("nome" as "title");
    const { data } = await query;
    setCategories((data as unknown as Category[]) || []);
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

  const handleCnpjLookup = async () => {
    if (!formData.employerCnpj) return;
    const cnpjData = await lookupCnpj(formData.employerCnpj);
    if (cnpjData) {
      setFormData((prev) => ({
        ...prev,
        employerName: prev.employerName || cnpjData.nome_fantasia || cnpjData.razao_social,
      }));
    }
  };

  // Auto-save function
  const performAutoSave = useCallback(async (dataToSave: PatientFormData) => {
    if (!currentClinic || !id) return;

    const updatePayload: Record<string, any> = {
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
      employer_cnpj: dataToSave.employerCnpj?.replace(/\D/g, '') || null,
      employer_name: dataToSave.employerName?.trim() || null,
      mother_name: dataToSave.motherName.trim() || null,
      father_name: dataToSave.fatherName.trim() || null,
    };

    if (isAdmin) {
      updatePayload.max_appointments_per_month = dataToSave.maxAppointmentsPerMonth;
    }

    const { error } = await supabase
      .from('patients')
      .update(updatePayload)
      .eq('id', id);

    if (error) throw error;

    setInitialData({ ...dataToSave, mobilePassword: '' });
    setFormData(prev => ({ ...prev, mobilePassword: '' }));
  }, [currentClinic, id, isAdmin]);

  const validateBeforeSave = useCallback((dataToValidate: PatientFormData): boolean => {
    const validation = patientSchema.safeParse({
      name: dataToValidate.name,
      phone: dataToValidate.phone,
      email: dataToValidate.email || undefined,
      cpf: dataToValidate.cpf || undefined,
    });
    return validation.success;
  }, []);

  const { status: autoSaveStatus } = useAutoSave({
    data: formData,
    initialData,
    onSave: performAutoSave,
    debounceMs: 3000,
    enabled: !loading && !!id && !!currentClinic,
    validateBeforeSave,
    storageKey: id ? `union-member-edit-draft:${id}` : undefined,
    onRestoreDraft: (draft) => {
      setFormData(draft);
    },
  });

  const handleTabChange = (tab: UnionMemberTab) => {
    if (tab === 'cadastro' || tab === 'dependentes' || tab === 'sindical' || tab === 'anexos' || tab === 'agendamentos') {
      setActiveTab(tab);
    } else if (tab === 'carteirinha') {
      openModal('patientCards', { patientId: id, patientName: formData.name });
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

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
      const updatePayload: Record<string, any> = {
        name: formData.name.trim(),
        phone: formData.phone.replace(/\D/g, '').trim(),
        email: formData.email.trim() || null,
        cpf: formData.cpf.replace(/\D/g, '').trim() || null,
        birth_date: formData.birthDate || null,
        notes: formData.notes.trim() || null,
        insurance_plan_id: formData.insurancePlanId || null,
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
        employer_cnpj: formData.employerCnpj?.replace(/\D/g, '') || null,
        employer_name: formData.employerName?.trim() || null,
        mother_name: formData.motherName.trim() || null,
        father_name: formData.fatherName.trim() || null,
      };

      if (isAdmin) {
        updatePayload.max_appointments_per_month = formData.maxAppointmentsPerMonth;
      }

      const { error } = await supabase
        .from('patients')
        .update(updatePayload)
        .eq('id', id);

      if (error) throw error;

      if (id) {
        try {
          localStorage.removeItem(`union-member-edit-draft:${id}`);
        } catch {
          // ignore
        }
      }

      toast({
        title: "Sócio atualizado",
        description: "As informações foram salvas com sucesso.",
      });

      navigate('/union/socios');
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

  const handleSaveUnionData = async () => {
    if (!id || !currentClinic || !user) return;

    setSavingUnion(true);
    try {
      const newValues = {
        union_member_status: unionStatus,
        union_category_id: unionCategoryId || null,
        union_contribution_value: unionContribution ? parseFloat(unionContribution) : null,
        union_payment_method: unionPaymentMethod || null,
        union_observations: unionObservations || null,
      };

      const { error: updateError } = await supabase
        .from("patients")
        .update(newValues)
        .eq("id", id);

      if (updateError) throw updateError;

      // Log the action
      await supabase.from("union_member_audit_logs").insert({
        clinic_id: currentClinic.id,
        patient_id: id,
        action: "data_update",
        new_values: newValues,
        performed_by: user.id,
        module_origin: "sindical",
      });

      toast({ title: "Dados sindicais atualizados!" });
      fetchMember();
    } catch (error: any) {
      console.error("Error updating:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingUnion(false);
    }
  };

  const handleUnlinkMember = async () => {
    if (!id || !currentClinic || !user) return;

    if (!confirm("Tem certeza que deseja desvincular este associado? O cadastro como paciente será mantido.")) {
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("patients")
        .update({
          is_union_member: false,
          union_member_status: null,
          union_category_id: null,
          union_contribution_value: null,
          union_payment_method: null,
          union_observations: null,
        })
        .eq("id", id);

      if (error) throw error;

      await supabase.from("union_member_audit_logs").insert({
        clinic_id: currentClinic.id,
        patient_id: id,
        action: "unlink",
        old_values: { is_union_member: true, union_member_status: unionStatus },
        new_values: { is_union_member: false },
        performed_by: user.id,
        module_origin: "sindical",
      });

      toast({ title: "Associado desvinculado com sucesso" });
      navigate("/union/socios");
    } catch (error: any) {
      toast({
        title: "Erro ao desvincular",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!id || !currentClinic) return;
    setTogglingActive(true);
    try {
      const { error } = await supabase
        .from('patients')
        .update({ is_active: !isPatientActive })
        .eq('id', id);
      if (error) throw error;
      setIsPatientActive(!isPatientActive);
      toast({
        title: isPatientActive ? "Sócio inativado" : "Sócio reativado",
        description: isPatientActive ? "O sócio foi marcado como inativo." : "O sócio foi reativado com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTogglingActive(false);
    }
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    ativo: { label: "Ativo", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    pendente: { label: "Pendente", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    inativo: { label: "Inativo", color: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
    suspenso: { label: "Suspenso", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentStatus = statusConfig[unionStatus] || statusConfig.pendente;

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/union/socios')} className="gap-2 flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <div className="flex items-center gap-3">
          <AutoSaveIndicator status={autoSaveStatus} />
          <Badge variant="outline" className={currentStatus.color}>
            {currentStatus.label}
          </Badge>
          {canManageMembers() && (
            <Button variant="destructive" size="sm" onClick={handleUnlinkMember} disabled={saving}>
              <UserX className="h-4 w-4 mr-2" />
              Desvincular
            </Button>
          )}
          <Button type="button" onClick={() => handleSubmit()} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar e Voltar
          </Button>
        </div>
      </div>

      {/* Inactive Alert */}
      {!isPatientActive && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserX className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Sócio Inativo</p>
              <p className="text-sm text-muted-foreground">Este sócio está inativo e não aparece nas listagens padrão.</p>
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
        isActive={isPatientActive}
        onToggleActive={handleToggleActive}
        togglingActive={togglingActive}
        isAdmin={isAdmin}
      />

      {/* Tabs Navigation */}
      <UnionMemberTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        memberId={id || ''}
      />

      {/* Tab Content */}
      {activeTab === 'cadastro' && (
        <div className="space-y-6">
          <div className="bg-card rounded-lg border p-6">
            <form onSubmit={handleSubmit}>
              {/* Photo Upload Section */}
              <div className="flex items-start gap-6 mb-6 pb-6 border-b">
                <PatientPhotoUpload
                  patientId={id!}
                  currentPhotoUrl={patientPhotoUrl}
                  patientName={formData.name}
                  onPhotoChange={setPatientPhotoUrl}
                />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Foto do Sócio</h3>
                  <p className="text-xs text-muted-foreground">
                    Clique no ícone da câmera para adicionar ou alterar a foto.
                    A foto será exibida na carteirinha digital.
                  </p>
                </div>
              </div>

              <PatientFormFields
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                insurancePlans={insurancePlans}
                onCepLookup={handleCepLookup}
                cepLoading={cepLoading}
                onCnpjLookup={handleCnpjLookup}
                cnpjLoading={cnpjLoading}
                isAdmin={isAdmin}
                clinicDefaultLimit={clinicDefaultLimit}
              />
            </form>
          </div>
        </div>
      )}

      {/* Aba Dependentes */}
      {activeTab === 'dependentes' && id && currentClinic && (
        <div className="bg-card rounded-lg border p-6">
          <DependentsPanel
            patientId={id}
            clinicId={currentClinic.id}
            patientPhone={formData.phone}
            autoOpenForm={showDependentsForm}
          />
        </div>
      )}

      {/* Aba Dados Sindicais */}
      {activeTab === 'sindical' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-500" />
                  Dados Sindicais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Status da Filiação</Label>
                    <Select
                      value={unionStatus}
                      onValueChange={setUnionStatus}
                      disabled={!canManageMembers()}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                        <SelectItem value="suspenso">Suspenso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Data de Filiação</Label>
                    <Input
                      value={
                        unionJoinedAt
                          ? format(new Date(unionJoinedAt), "dd/MM/yyyy", { locale: ptBR })
                          : "-"
                      }
                      disabled
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={unionCategoryId}
                      onValueChange={setUnionCategoryId}
                      disabled={!canManageMembers()}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Valor da Contribuição (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={unionContribution}
                      onChange={(e) => setUnionContribution(e.target.value)}
                      disabled={!canManageMembers()}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Forma de Pagamento</Label>
                    <Select
                      value={unionPaymentMethod}
                      onValueChange={setUnionPaymentMethod}
                      disabled={!canManageMembers()}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="debito_folha">Débito em Folha</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="cartao">Cartão</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={unionObservations}
                    onChange={(e) => setUnionObservations(e.target.value)}
                    placeholder="Observações sobre a filiação..."
                    rows={3}
                    disabled={!canManageMembers()}
                  />
                </div>

                {canManageMembers() && (
                  <div className="flex justify-end">
                    <Button onClick={handleSaveUnionData} disabled={savingUnion}>
                      {savingUnion ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Salvar Alterações
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Ficha de Filiação Share Card */}
          <div className="lg:col-span-1">
            <MemberFiliacaoShareCard
              member={{
                id: id!,
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                cpf: formData.cpf,
              }}
              clinicId={currentClinic?.id || ''}
            />
          </div>
        </div>
      )}

      {/* Aba Agendamentos */}
      {activeTab === 'agendamentos' && id && (
        <div className="bg-card rounded-lg border">
          <UnionMemberSchedulingTab
            patientId={id}
            patientName={formData.name}
          />
        </div>
      )}

      {/* Modals */}
      <PatientCardsModal
        open={isModalOpen('patientCards')}
        onOpenChange={(open) => open ? null : closeModal('patientCards')}
        patientId={getModalData('patientCards').patientId || id || ''}
        patientName={getModalData('patientCards').patientName || formData.name}
      />

      <PatientAppointmentsModal
        open={isModalOpen('patientAppointments')}
        onOpenChange={(open) => open ? null : closeModal('patientAppointments')}
        patientId={getModalData('patientAppointments').patientId || id || ''}
        patientName={getModalData('patientAppointments').patientName || formData.name}
      />
    </div>
  );
}
