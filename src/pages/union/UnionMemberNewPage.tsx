import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Save, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCepLookup } from "@/hooks/useCepLookup";
import { useCnpjLookup } from "@/hooks/useCnpjLookup";
import { z } from "zod";

import { PatientFormFields, PatientFormData } from "@/components/patients/PatientFormFields";

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

interface InsurancePlan {
  id: string;
  name: string;
}

export default function UnionMemberNewPage() {
  const navigate = useNavigate();
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const { lookupCep, loading: cepLoading } = useCepLookup();
  const { lookupCnpj, cnpjLoading } = useCnpjLookup();

  const [saving, setSaving] = useState(false);
  const [insurancePlans, setInsurancePlans] = useState<InsurancePlan[]>([]);
  const [formData, setFormData] = useState<PatientFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch insurance plans on mount
  useEffect(() => {
    if (currentClinic) {
      supabase
        .from('insurance_plans')
        .select('id, name')
        .eq('clinic_id', currentClinic.id)
        .eq('is_active', true)
        .order('name')
        .then(({ data }) => {
          setInsurancePlans(data || []);
        });
    }
  }, [currentClinic]);

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
      toast({
        title: "Dados inválidos",
        description: "Corrija os erros no formulário antes de continuar.",
        variant: "destructive",
      });
      return;
    }

    if (!currentClinic) return;

    setSaving(true);
    setErrors({});

    try {
      // Generate registration number
      const { data: regData } = await supabase.rpc('generate_patient_registration_number', {
        p_clinic_id: currentClinic.id
      });

      const { data: newPatient, error } = await supabase
        .from('patients')
        .insert({
          clinic_id: currentClinic.id,
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
          registration_number: regData || undefined,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) {
        // Check for CPF duplicate error
        if (error.message?.includes('CPF_DUPLICADO') || error.code === '23505') {
          toast({
            title: "CPF já cadastrado",
            description: "Este CPF já está registrado no sistema.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Sócio cadastrado!",
        description: "O novo sócio foi criado com sucesso.",
      });

      // Navigate to the new member's detail page
      navigate(`/union/socios/${newPatient.id}`);
    } catch (error: any) {
      console.error("Error creating member:", error);
      toast({
        title: "Erro ao cadastrar",
        description: error.message || "Não foi possível criar o sócio.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/union/socios')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <User className="h-6 w-6 text-primary" />
              Novo Sócio
            </h1>
            <p className="text-sm text-muted-foreground">
              Preencha os dados do novo sócio
            </p>
          </div>
        </div>
        <Button
          onClick={() => handleSubmit()}
          disabled={saving}
          className="gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Salvar
            </>
          )}
        </Button>
      </div>

      {/* Form */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit}>
            <PatientFormFields
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              insurancePlans={insurancePlans}
              onCepLookup={handleCepLookup}
              cepLoading={cepLoading}
              onCnpjLookup={handleCnpjLookup}
              cnpjLoading={cnpjLoading}
            />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
