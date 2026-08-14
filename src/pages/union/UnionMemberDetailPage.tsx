import { useEffect, useState, useCallback, useMemo} from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
 import { ArrowLeft, Loader2, UserX, UserCheck, Users, Save, Pen, CheckCircle, Send, MessageCircle, FileText } from "lucide-react";
import { extractFunctionsError } from "@/lib/functionsError";
import { openWhatsApp } from "@/lib/whatsapp";
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
 import { MemberFiliacaoActionsDialog } from "@/components/union/members/MemberFiliacaoActionsDialog";
import { UnionMemberSchedulingTab } from "@/components/union/members/UnionMemberSchedulingTab";
import { DependentAppointmentsList } from "@/components/union/members/DependentAppointmentsList";
import { UnionMemberAttachmentsTab } from "@/components/union/members/UnionMemberAttachmentsTab";
import { MemberQuickSearch } from "@/components/union/members/MemberQuickSearch";

import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
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

const normalizeMemberName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const collapseRepeatedLetters = (value: string): string => value.replace(/(.)\1+/g, '$1');

const isPlaceholderMemberRecord = (member: Record<string, any>): boolean => {
  const identityFields = [
    member.cpf,
    member.birth_date,
    member.phone,
    member.email,
    member.mother_name,
    member.father_name,
  ];

  return !member.is_union_member && identityFields.every((field) => !field);
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
  birthDate: z.string().min(1, "Data de nascimento é obrigatória"),
  motherName: z.string().min(1, "Nome da mãe é obrigatório"),
  fatherName: z.string().min(1, "Nome do pai é obrigatório"),
}).refine((data) => {
  if (!data.birthDate) return false;
  const birth = new Date(data.birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 18;
}, {
  message: "O associado titular deve ser maior de idade (18 anos ou mais)",
  path: ["birthDate"],
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
  jobFunction: '',
  admissionDate: '',
  affiliationDate: '',
  notes: '',
  maxAppointmentsPerMonth: null,
  mobilePassword: '',
};

export default function UnionMemberDetailPage({ 
  memberIdOverride, 
  isModalMode 
}: { 
  memberIdOverride?: string; 
  isModalMode?: boolean; 
} = {}) {
  const { id: paramId } = useParams<{ id: string }>();
  const id = memberIdOverride || paramId;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentClinic, user, userRoles} = useAuth();

  const resolvedClinic = useMemo(
    () => userRoles.find((role) => role.clinic_id === SINDICATO_CLINIC_ID)?.clinic || currentClinic,
    [currentClinic, userRoles]
  );
  const { hasPermission, isAdmin } = usePermissions();
  const { canManageMembers, canEditMemberConvenio } = useUnionPermissions();
  const canChangePassword = isAdmin || hasPermission("change_password");
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
  
  // Signature data
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureImageUrl, setSignatureImageUrl] = useState<string | null>(null);
  const [signatureAcceptedAt, setSignatureAcceptedAt] = useState<string | null>(null);
   const [sendingSignatureRequest, setSendingSignatureRequest] = useState(false);
   const [isFiliacaoDialogOpen, setIsFiliacaoDialogOpen] = useState(false);

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
    if (resolvedClinic && id) {
      fetchMember();
      fetchInsurancePlans();
      fetchCategories();
      fetchClinicLimit();
    }
  }, [resolvedClinic, id]);

  const fetchClinicLimit = async () => {
    if (!resolvedClinic) return;
    try {
      const { data } = await supabase
        .from('clinics')
        .select('max_appointments_per_cpf_month')
        .eq('id', resolvedClinic.id)
        .single();
      setClinicDefaultLimit(data?.max_appointments_per_cpf_month ?? null);
    } catch (error) {
      console.error("Error fetching clinic limit:", error);
    }
  };

  const fetchMember = async () => {
    if (!resolvedClinic || !id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*, insurance_plans(name)')
        .eq('id', id)
        .eq('clinic_id', resolvedClinic.id)
        .single();

      if (error) throw error;

      if (data) {
        if (isPlaceholderMemberRecord(data)) {
          const normalizedName = collapseRepeatedLetters(normalizeMemberName(data.name || ''));
          const rawTokens = normalizedName.split(' ').filter((token) => token.length >= 3);
          const uniqueTokens = Array.from(new Set(rawTokens));
          const prioritizedTokens = [
            uniqueTokens[0],
            ...uniqueTokens.slice(1).sort((a, b) => b.length - a.length),
          ].filter(Boolean).slice(0, 3);

          let fallbackQuery = supabase
            .from('patients')
            .select('id, name, cpf, birth_date, phone, email, is_union_member')
            .eq('clinic_id', resolvedClinic.id)
            .eq('is_union_member', true)
            .neq('id', id);

          prioritizedTokens.forEach((token) => {
            fallbackQuery = fallbackQuery.ilike('name', `%${token}%`);
          });

          const { data: fallbackMembers, error: fallbackError } = await fallbackQuery.limit(10);

          if (!fallbackError && fallbackMembers?.length) {
            const bestMatch = fallbackMembers.find((member) => {
              const candidateName = collapseRepeatedLetters(normalizeMemberName(member.name || ''));
              return candidateName === normalizedName;
            }) || fallbackMembers[0];

            navigate(`/union/socios/${bestMatch.id}`, { replace: true });
            toast({
              title: 'Cadastro principal localizado',
              description: 'Abrimos o registro válido deste sócio automaticamente.',
            });
            return;
          }
        }

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
          jobFunction: (data as any).job_function || '',
          admissionDate: (data as any).admission_date || '',
          affiliationDate: (data as any).union_affiliation_date || '',
          notes: data.notes || '',
          maxAppointmentsPerMonth: (data as any).max_appointments_per_month ?? null,
        };
        try {
          localStorage.removeItem(`union-member-edit-draft:${id}`);
        } catch {
          // ignore
        }

        setFormData(loadedData);
        setInitialData(loadedData);

        const effectiveStatus = data.union_member_status || data.tag?.toLowerCase() || "pendente";
        setUnionStatus(effectiveStatus);
        setUnionCategoryId(data.union_category_id || "");
        setUnionContribution(data.union_contribution_value?.toString() || "");
        setUnionPaymentMethod(data.union_payment_method || "");
        setUnionObservations(data.union_observations || "");
        setUnionJoinedAt(data.union_joined_at);
        const rawSignatureUrl = (data as any).signature_url || null;
        setSignatureUrl(rawSignatureUrl);
        setSignatureAcceptedAt((data as any).signature_accepted_at || null);

        // Generate signed URL for the signature image
        if (rawSignatureUrl) {
          const { data: signedData } = await supabase.storage
            .from("patient-signatures")
            .createSignedUrl(rawSignatureUrl, 3600);
          setSignatureImageUrl(signedData?.signedUrl || null);
        } else {
          setSignatureImageUrl(null);
        }
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
    if (!resolvedClinic) return;
    try {
      const { data, error } = await supabase
        .from('insurance_plans')
        .select('id, name')
        .eq('clinic_id', resolvedClinic.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setInsurancePlans(data || []);
    } catch (error) {
      console.error("Error fetching insurance plans:", error);
    }
  };

  const fetchCategories = async () => {
    if (!resolvedClinic) return;
    const query = supabase
      .from("sindical_categorias" as "anamnese_templates")
      .select("id, nome, valor_contribuicao")
      .eq("sindicato_id" as "clinic_id", resolvedClinic.id)
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

  const handleNavigateToEmployer = async () => {
    const cnpj = formData.employerCnpj?.replace(/\D/g, '');
    if (!cnpj || !resolvedClinic?.id) return;
    const { data } = await supabase
      .from("employers")
      .select("id")
      .eq("clinic_id", resolvedClinic.id)
      .or(`cnpj.eq.${cnpj},cnpj.eq.${formData.employerCnpj}`)
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      navigate(`/union/empresas/${data.id}`);
    } else {
      toast({ title: "Empresa não encontrada", description: "Nenhum cadastro de empresa encontrado com este CNPJ.", variant: "destructive" });
    }
  };


  const performAutoSave = useCallback(async (dataToSave: PatientFormData) => {
    if (!resolvedClinic || !id) return;

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

    if (isAdmin && dataToSave.mobilePassword && dataToSave.mobilePassword.length >= 6) {
      const { error: pwError } = await supabase.rpc('set_patient_password', {
        p_patient_id: id,
        p_password: dataToSave.mobilePassword,
      });

      if (pwError) {
        console.error('Error setting password:', pwError);
      }
    }

    setInitialData({ ...dataToSave, mobilePassword: '' });
    setFormData(prev => ({ ...prev, mobilePassword: '' }));
  }, [resolvedClinic, id, isAdmin]);

  const validateBeforeSave = useCallback((dataToValidate: PatientFormData): boolean => {
    const validation = patientSchema.safeParse({
      name: dataToValidate.name,
      phone: dataToValidate.phone,
      email: dataToValidate.email || undefined,
      cpf: dataToValidate.cpf || undefined,
      birthDate: dataToValidate.birthDate,
      motherName: dataToValidate.motherName,
      fatherName: dataToValidate.fatherName,
    });
    return validation.success;
  }, []);

  const { status: autoSaveStatus } = useAutoSave({
    data: formData,
    initialData,
    onSave: performAutoSave,
    debounceMs: 3000,
    enabled: !loading && !!id && !!resolvedClinic,
    validateBeforeSave,
    // Cache/draft desabilitado para edições de cadastro - garante consistência entre usuários
  });

  const handleTabChange = (tab: UnionMemberTab) => {
    if (tab === 'cadastro' || tab === 'dependentes' || tab === 'sindical' || tab === 'anexos' || tab === 'agendamentos') {
      setActiveTab(tab);
    } else if (tab === 'carteirinha') {
      openModal('patientCards', { patientId: id, patientName: formData.name });
    }
  };

  const handleSubmit = async (e?: React.FormEvent | boolean) => {
    if (e && typeof e !== 'boolean') e.preventDefault();
    const shouldNavigateBack = typeof e === 'boolean' ? e : true;

    const validation = patientSchema.safeParse({
      name: formData.name,
      phone: formData.phone,
      email: formData.email || undefined,
      cpf: formData.cpf || undefined,
      birthDate: formData.birthDate,
      motherName: formData.motherName,
      fatherName: formData.fatherName,
    });

    if (!validation.success) {
      const newErrors: Record<string, string> = {};
      const errorMessages: string[] = [];
      validation.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        newErrors[field] = err.message;
        errorMessages.push(err.message);
      });
      setErrors(newErrors);
      toast({
        title: "Erro de validação",
        description: errorMessages.slice(0, 3).join("; "),
        variant: "destructive",
      });
      // Scroll to first error field
      const firstErrorField = Object.keys(newErrors)[0];
      if (firstErrorField) {
        const el = document.querySelector(`[name="${firstErrorField}"], [data-field="${firstErrorField}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    if (!resolvedClinic || !id) return;

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
        job_function: formData.jobFunction.trim() || null,
        admission_date: formData.admissionDate || null,
        union_affiliation_date: formData.affiliationDate || null,
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

      if (shouldNavigateBack) {
        navigate('/union/socios');
      }
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
    if (!id || !resolvedClinic || !user) return;

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
        clinic_id: resolvedClinic.id,
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
    if (!id || !resolvedClinic || !user) return;

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
          password_hash: null,
        })
        .eq("id", id);

      if (error) throw error;

      await supabase.from("union_member_audit_logs").insert({
        clinic_id: resolvedClinic.id,
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
    if (!id || !resolvedClinic) return;
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

  const renderActionButtons = (
    <div className="flex flex-wrap items-center gap-3">
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
      <div className="flex items-center gap-1.5">
        {id && resolvedClinic && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-primary font-medium"
            onClick={() => setIsFiliacaoDialogOpen(true)}
          >
            <FileText className="h-4 w-4" />
            Ficha de Filiação
          </Button>
        )}
        {!isModalMode && (
          <Button type="button" onClick={() => handleSubmit()} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar e Voltar
          </Button>
        )}
        {isModalMode && (
          <Button type="button" onClick={() => handleSubmit(false)} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar Alterações
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col min-h-screen bg-muted/20 ${isModalMode ? 'p-0 pb-10' : 'p-4 md:p-8'}`}>
      <div className={`${isModalMode ? 'w-full' : 'max-w-7xl mx-auto space-y-6'}`}>
        {!isModalMode && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/union/socios")}
                className="hover:bg-background"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold tracking-tight text-teal-800">
                  {loading ? 'Carregando...' : formData.name || 'Novo Sócio'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Gerencie os dados e o histórico do sócio
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {renderActionButtons}
            </div>
          </div>
        )}

        {isModalMode && (
          <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b px-6 py-3 mb-6 flex items-center justify-between">
             <div className="flex items-center gap-4">
               <h2 className="text-lg font-bold text-teal-800 truncate max-w-[400px]">
                 {formData.name || 'Novo Sócio'}
               </h2>
               <Badge variant="outline" className={unionStatus === 'ativo' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}>
                  {unionStatus.charAt(0).toUpperCase() + unionStatus.slice(1)}
               </Badge>
             </div>
             <div className="flex items-center gap-2">
               {renderActionButtons}
             </div>
          </div>
        )}

        <div className={`grid grid-cols-1 ${isModalMode ? 'lg:grid-cols-12' : 'lg:grid-cols-3'} gap-6 ${isModalMode ? 'px-6 pb-6' : ''}`}>
          <div className={isModalMode ? 'lg:col-span-4' : 'lg:col-span-1'}>

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
        </div>

        {/* Tab Content */}
        <div className={isModalMode ? 'lg:col-span-8' : 'lg:col-span-2'}>
      {activeTab === 'cadastro' && (
        <div className="space-y-6">
          <div className="bg-card rounded-lg border p-6">
            <form onSubmit={handleSubmit}>
              {/* Photo Upload Section */}
              <div className="flex items-start gap-6 mb-6 pb-6 border-b">
                <PatientPhotoUpload
                  patientId={id!}
                  clinicId={resolvedClinic?.id}
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
                canChangePassword={canChangePassword}
                clinicDefaultLimit={clinicDefaultLimit}
                canEditConvenio={canEditMemberConvenio()}
                onNavigateToEmployer={handleNavigateToEmployer}
              />
            </form>
          </div>
        </div>
      )}

      {/* Aba Dependentes */}
      {activeTab === 'dependentes' && id && resolvedClinic && (
        <div className="bg-card rounded-lg border p-6">
          <DependentsPanel
            patientId={id}
            clinicId={resolvedClinic.id}
            patientPhone={formData.phone}
            autoOpenForm={showDependentsForm}
          />
          <DependentAppointmentsList
            patientId={id}
            clinicId={resolvedClinic.id}
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

                {/* Digital Signature Section */}
                <div className="border-t pt-6 mt-6">
                  <h4 className="font-medium text-sm mb-4 flex items-center gap-2">
                    <Pen className="h-4 w-4 text-violet-600" />
                    Assinatura Digital - Autorização de Desconto
                  </h4>
                  
                   {signatureUrl ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                        <CheckCircle className="h-4 w-4" />
                        <span>
                          Assinatura registrada em{" "}
                          {signatureAcceptedAt
                            ? format(new Date(signatureAcceptedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : "-"}
                        </span>
                      </div>
                      <div className="border rounded-lg p-4 bg-muted/30">
                        <Label className="text-xs text-muted-foreground mb-2 block">Assinatura do Sócio</Label>
                        {signatureImageUrl ? (
                          <img
                            src={signatureImageUrl}
                            alt="Assinatura digital"
                            className="max-h-32 bg-white rounded border p-2"
                            onError={() => setSignatureImageUrl(null)}
                          />
                        ) : (
                          <div className="text-xs text-muted-foreground italic py-2">
                            Não foi possível carregar a imagem da assinatura.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground bg-muted/30 px-4 py-3 rounded-lg border border-dashed">
                        Nenhuma assinatura digital registrada.
                      </div>
                      {canManageMembers() && (
                        <div className="flex flex-wrap gap-2">
                          {formData.email && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={sendingSignatureRequest}
                              onClick={async () => {
                                if (!resolvedClinic || !id) return;
                                setSendingSignatureRequest(true);
                                try {
                                  const { data, error } = await supabase.functions.invoke("send-signature-request", {
                                    body: { associadoId: id, clinicId: resolvedClinic.id },
                                  });
                                  if (error) throw error;
                                  if (data?.error) throw new Error(data.error);
                                  toast({ title: "Solicitação enviada!", description: `Email enviado para ${formData.email}` });
                                } catch (err: any) {
                                  const extracted = extractFunctionsError(err);
                                  toast({ title: "Erro ao enviar", description: extracted.message, variant: "destructive" });
                                } finally {
                                  setSendingSignatureRequest(false);
                                }
                              }}
                              className="gap-2 text-violet-600 border-violet-200 hover:bg-violet-50"
                            >
                              {sendingSignatureRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                              Solicitar Assinatura por Email
                            </Button>
                          )}

                           {formData.phone && (
                             <Button
                               variant="outline"
                               size="sm"
                               disabled={sendingSignatureRequest}
                               onClick={async () => {
                                 if (!resolvedClinic || !id) return;
                                 setSendingSignatureRequest(true);
                                 try {
                                   const { data, error } = await supabase.functions.invoke("send-signature-request", {
                                     body: { associadoId: id, clinicId: resolvedClinic.id, createOnly: true },
                                   });
                                   if (error) throw error;
                                   if (data?.error) throw new Error(data.error);

                                   const baseUrl = window.location.origin;
                                   const signatureUrl = `${baseUrl}/assinar/${data.token}`;
                                   
                                   const { data: sindicato } = await supabase
                                     .from("union_entities")
                                     .select("razao_social")
                                     .eq("clinic_id", resolvedClinic.id)
                                     .maybeSingle();

                                   const message = `✍️ *Autorização de Desconto em Folha*\n\nOlá, *${formData.name}*!\n\nO *${sindicato?.razao_social || "Sindicato"}* solicita que você assine digitalmente a autorização de desconto em folha.\n\n📝 *Acesse o link abaixo para assinar:* \n${signatureUrl}\n\nAtenciosamente,\n*${sindicato?.razao_social || "Sindicato"}*`;

                                   openWhatsApp(formData.phone, message);
                                 } catch (err: any) {
                                   const extracted = extractFunctionsError(err);
                                   toast({ title: "Erro ao gerar link", description: extracted.message, variant: "destructive" });
                                 } finally {
                                   setSendingSignatureRequest(false);
                                 }
                               }}
                               className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-medium"
                             >
                               {sendingSignatureRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                               Link Assinatura (Manual)
                             </Button>
                           )}
                        </div>
                      )}
                    </div>
                  )}
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
          <div className={`${isModalMode ? 'lg:col-span-4' : 'lg:col-span-1'}`}>
            <MemberFiliacaoShareCard
              member={{
                id: id!,
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                cpf: formData.cpf,
              }}
               clinicId={resolvedClinic?.id || ''}
               memberPhotoUrl={patientPhotoUrl}
            />
          </div>
        </div>
      )}

      {/* Aba Anexos */}
      {activeTab === 'anexos' && id && (
        <div className="bg-card rounded-lg border">
          <UnionMemberAttachmentsTab patientId={id} clinicId={resolvedClinic?.id} />
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
      </div>


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

       {/* Ficha de Filiação Dialog */}
       {id && resolvedClinic && isFiliacaoDialogOpen && (
         <MemberFiliacaoActionsDialog
           open={isFiliacaoDialogOpen}
           onOpenChange={setIsFiliacaoDialogOpen}
           clinicId={resolvedClinic.id}
           member={{
             id,
             name: formData.name,
             email: formData.email,
             phone: formData.phone,
             cpf: formData.cpf,
             photo_url: patientPhotoUrl,
             employer_name: formData.employerName,
             employer_cnpj: formData.employerCnpj,
             registration_number: formData.registrationNumber,
           }}
         />
        )}
    </div>
  );
}
