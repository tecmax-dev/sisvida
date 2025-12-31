import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Upload, Save, Cloud, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSpecialties } from "@/hooks/useSpecialties";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useSubscription } from "@/hooks/useSubscription";
import { SpecialtySelector } from "@/components/professionals/SpecialtySelector";
import { ProfessionalFormFields } from "@/components/professionals/ProfessionalFormFields";
import { ScheduleTab } from "@/components/professionals/ScheduleTab";
import { PROFESSIONAL_COUNCILS } from "@/lib/professionalCouncils";
import { z } from "zod";
import { Json } from "@/integrations/supabase/types";

interface Procedure {
  id: string;
  name: string;
}

interface InsurancePlan {
  id: string;
  name: string;
}

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  registration_number: string | null;
  phone: string | null;
  email: string | null;
  user_id: string | null;
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
  schedule: Json;
  appointment_duration: number | null;
}

interface ClinicUser {
  user_id: string;
  profile: { name: string } | null;
}

const professionalSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(100),
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

export default function ProfessionalEditPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'basic';
  const navigate = useNavigate();
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const { hasFeature } = usePlanFeatures();
  const { canAddProfessional, refetch: refetchSubscription } = useSubscription();
  const {
    loading: loadingSpecialties,
    groupedSpecialties,
    saveProfessionalSpecialties,
    fetchProfessionalSpecialties,
    getSpecialtyById,
  } = useSpecialties();
  
  const isCreating = !id;
  
  const [loading, setLoading] = useState(!isCreating);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [clinicUsers, setClinicUsers] = useState<ClinicUser[]>([]);
  
  // Auto-save refs
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);
  
  // Form state
  const [name, setName] = useState("");
  const [specialtyIds, setSpecialtyIds] = useState<string[]>([]);
  const [councilType, setCouncilType] = useState("");
  const [crm, setCrm] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [telemedicineEnabled, setTelemedicineEnabled] = useState(false);
  const [appointmentDuration, setAppointmentDuration] = useState(30);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Avatar
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  // Public profile fields
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [bio, setBio] = useState("");
  const [education, setEducation] = useState("");
  const [experience, setExperience] = useState("");

  // Procedures
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [selectedProcedureIds, setSelectedProcedureIds] = useState<string[]>([]);

  // Insurance Plans
  const [insurancePlans, setInsurancePlans] = useState<InsurancePlan[]>([]);
  const [selectedInsuranceIds, setSelectedInsuranceIds] = useState<string[]>([]);

  // Initial data for comparison
  const [initialFormData, setInitialFormData] = useState<string>("");

  useEffect(() => {
    if (currentClinic) {
      fetchClinicUsers();
      if (id) {
        fetchProfessional();
        fetchProcedures();
        fetchInsurancePlans();
      } else {
        // Creating mode - fetch insurance plans too
        fetchInsurancePlans();
        hasLoadedRef.current = true;
      }
    }
  }, [currentClinic, id]);

  const fetchProfessional = async () => {
    if (!currentClinic || !id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('*')
        .eq('id', id)
        .eq('clinic_id', currentClinic.id)
        .single();

      if (error) throw error;
      
      if (data) {
        setProfessional(data);
        setName(data.name);
        setCouncilType(data.council_type || "");
        setCrm(data.registration_number || "");
        setPhone(data.phone || "");
        setEmail(data.email || "");
        setUserId(data.user_id || "");
        setTelemedicineEnabled(data.telemedicine_enabled || false);
        setAppointmentDuration(data.appointment_duration || 30);
        setAvatarPreview(data.avatar_url || null);
        setAddress(data.address || "");
        setCity(data.city || "");
        setState(data.state || "");
        setZipCode(data.zip_code || "");
        setWhatsapp(data.whatsapp || "");
        setBio(data.bio || "");
        setEducation(data.education || "");
        setExperience(data.experience || "");
        
        // Load specialties
        const existingIds = await fetchProfessionalSpecialties(data.id);
        setSpecialtyIds(existingIds);
        
        // Set initial data for auto-save comparison
        const initialData = JSON.stringify({
          name: data.name,
          councilType: data.council_type || "",
          crm: data.registration_number || "",
          phone: data.phone || "",
          email: data.email || "",
          userId: data.user_id || "",
          telemedicineEnabled: data.telemedicine_enabled || false,
          appointmentDuration: data.appointment_duration || 30,
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          zipCode: data.zip_code || "",
          whatsapp: data.whatsapp || "",
          bio: data.bio || "",
          education: data.education || "",
          experience: data.experience || "",
          specialtyIds: existingIds,
        });
        setInitialFormData(initialData);
        hasLoadedRef.current = true;
      }
    } catch (error) {
      console.error("Error fetching professional:", error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar os dados do profissional.",
        variant: "destructive",
      });
      navigate('/dashboard/professionals');
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

      console.log('[DEBUG] fetchClinicUsers - rolesData:', rolesData, 'error:', rolesError);

      if (!rolesData || rolesData.length === 0) {
        console.log('[DEBUG] fetchClinicUsers - No roles found for clinic');
        setClinicUsers([]);
        return;
      }

      const userIds = rolesData.map(r => r.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      console.log('[DEBUG] fetchClinicUsers - profilesData:', profilesData, 'error:', profilesError);

      const users: ClinicUser[] = (profilesData || []).map(p => ({
        user_id: p.user_id,
        profile: { name: p.name },
      }));
      
      console.log('[DEBUG] fetchClinicUsers - final users list:', users);
      setClinicUsers(users);
    } catch (error) {
      console.error("Error fetching clinic users:", error);
    }
  };

  const fetchProcedures = async () => {
    if (!currentClinic || !id) return;
    
    try {
      // Fetch all active procedures for the clinic
      const { data: proceduresData } = await supabase
        .from("procedures")
        .select("id, name")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");
      
      setProcedures(proceduresData || []);

      // Fetch procedures already linked to this professional
      const { data: linkedData } = await supabase
        .from("professional_procedures")
        .select("procedure_id")
        .eq("professional_id", id);
      
      setSelectedProcedureIds((linkedData || []).map(l => l.procedure_id));
    } catch (error) {
      console.error("Error fetching procedures:", error);
    }
  };

  const fetchInsurancePlans = async () => {
    if (!currentClinic) return;
    
    try {
      const { data } = await supabase
        .from("insurance_plans")
        .select("id, name")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");
      
      setInsurancePlans(data || []);

      // If editing, fetch insurance plans already linked to this professional
      if (id) {
        const { data: linkedData } = await supabase
          .from("professional_insurance_plans")
          .select("insurance_plan_id")
          .eq("professional_id", id);
        
        setSelectedInsuranceIds((linkedData || []).map(l => l.insurance_plan_id));
      }
    } catch (error) {
      console.error("Error fetching insurance plans:", error);
    }
  };

  const saveProfessionalInsurancePlans = async (professionalId: string) => {
    // Delete existing links
    await supabase
      .from("professional_insurance_plans")
      .delete()
      .eq("professional_id", professionalId);
    
    // Insert new links
    if (selectedInsuranceIds.length > 0) {
      const inserts = selectedInsuranceIds.map(insuranceId => ({
        professional_id: professionalId,
        insurance_plan_id: insuranceId,
      }));
      
      await supabase
        .from("professional_insurance_plans")
        .insert(inserts);
    }
  };

  const saveProfessionalProcedures = async (professionalId: string) => {
    // Delete existing links
    await supabase
      .from("professional_procedures")
      .delete()
      .eq("professional_id", professionalId);
    
    // Insert new links
    if (selectedProcedureIds.length > 0) {
      const inserts = selectedProcedureIds.map(procedureId => ({
        professional_id: professionalId,
        procedure_id: procedureId,
      }));
      
      await supabase
        .from("professional_procedures")
        .insert(inserts);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setAvatarPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Auto-save function (only for editing)
  const performAutoSave = useCallback(async () => {
    if (!currentClinic || !id || !professional || !hasLoadedRef.current || isCreating) return;
    
    // Validate before saving
    const validation = professionalSchema.safeParse({
      name,
      email: email || undefined,
    });
    
    if (!validation.success) return; // Don't auto-save invalid data

    setAutoSaveStatus('saving');

    try {
      // Get display name from selected specialties
      const specialtyNames = specialtyIds
        .map(specId => getSpecialtyById(specId)?.name)
        .filter((n): n is string => !!n);
      const specialtyDisplay = specialtyNames.join(', ') || null;

      const { error } = await supabase
        .from('professionals')
        .update({
          name: name.trim(),
          specialty: specialtyDisplay,
          council_type: councilType || null,
          registration_number: crm.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          user_id: userId || null,
          telemedicine_enabled: hasFeature('telemedicine') ? telemedicineEnabled : false,
          appointment_duration: appointmentDuration,
          address: address.trim() || null,
          city: city.trim() || null,
          state: state || null,
          zip_code: zipCode.replace(/\D/g, '') || null,
          whatsapp: whatsapp.replace(/\D/g, '') || null,
          bio: bio.trim() || null,
          education: education.trim() || null,
          experience: experience.trim() || null,
        })
        .eq('id', id);

      if (error) throw error;

      // Save specialties silently
      await saveProfessionalSpecialties(id, specialtyIds);
      
      // Update initial data
      const newInitialData = JSON.stringify({
        name, councilType, crm, phone, email, userId, telemedicineEnabled,
        appointmentDuration, address, city, state, zipCode,
        whatsapp, bio, education, experience, specialtyIds,
      });
      setInitialFormData(newInitialData);
      
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch (error) {
      console.error("Auto-save error:", error);
      setAutoSaveStatus('idle');
    }
  }, [currentClinic, id, professional, isCreating, name, councilType, crm, phone, email, userId, telemedicineEnabled,
      appointmentDuration, address, city, state, zipCode, whatsapp, bio, education, 
      experience, specialtyIds, getSpecialtyById, hasFeature, saveProfessionalSpecialties]);

  // Get current form data for comparison
  const getCurrentFormData = useCallback(() => {
    return JSON.stringify({
      name, councilType, crm, phone, email, userId, telemedicineEnabled,
      appointmentDuration, address, city, state, zipCode,
      whatsapp, bio, education, experience, specialtyIds,
    });
  }, [name, councilType, crm, phone, email, userId, telemedicineEnabled,
      appointmentDuration, address, city, state, zipCode,
      whatsapp, bio, education, experience, specialtyIds]);

  // Auto-save effect with debounce
  useEffect(() => {
    if (!hasLoadedRef.current || getCurrentFormData() === initialFormData) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      performAutoSave();
    }, 3000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [getCurrentFormData, initialFormData, performAutoSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = professionalSchema.safeParse({
      name,
      email: email || undefined,
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

    if (!currentClinic) return;
    
    // For editing, we need the professional to exist
    if (!isCreating && !professional) return;

    setSaving(true);
    setErrors({});

    try {
      // Get display name from selected specialties
      const specialtyNames = specialtyIds
        .map(specId => getSpecialtyById(specId)?.name)
        .filter((n): n is string => !!n);
      const specialtyDisplay = specialtyNames.join(', ') || null;

      let professionalId = id;
      let avatarUrl: string | null = professional?.avatar_url || null;

      if (isCreating) {
        // CREATE new professional
        const slug = generateSlug(name);
        
        const { data: newProfessional, error } = await supabase
          .from('professionals')
          .insert({
            clinic_id: currentClinic.id,
            name: name.trim(),
            specialty: specialtyDisplay,
            council_type: councilType || null,
            registration_number: crm.trim() || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
            user_id: userId || null,
            telemedicine_enabled: hasFeature('telemedicine') ? telemedicineEnabled : false,
            appointment_duration: appointmentDuration,
            slug,
            address: address.trim() || null,
            city: city.trim() || null,
            state: state || null,
            zip_code: zipCode.replace(/\D/g, '') || null,
            whatsapp: whatsapp.replace(/\D/g, '') || null,
            bio: bio.trim() || null,
            education: education.trim() || null,
            experience: experience.trim() || null,
          })
          .select('id')
          .single();

        if (error) throw error;
        professionalId = newProfessional.id;

        // Upload avatar if selected
        if (avatarFile && professionalId) {
          const fileExt = avatarFile.name.split('.').pop();
          const filePath = `${currentClinic.id}/${professionalId}.${fileExt}`;
          
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
              .eq('id', professionalId);
          }
        }

        // Save specialties
        if (professionalId && specialtyIds.length > 0) {
          await saveProfessionalSpecialties(professionalId, specialtyIds);
        }

        // Save insurance plans
        if (professionalId) {
          await saveProfessionalInsurancePlans(professionalId);
        }

        toast({
          title: "Profissional cadastrado",
          description: userId 
            ? "O profissional foi vinculado e pode acessar o portal." 
            : "O profissional foi adicionado com sucesso.",
        });

        refetchSubscription();
        
        // Navigate to edit page to enable auto-save
        navigate(`/dashboard/professionals/${professionalId}/edit`);
        return;
      } else {
        // UPDATE existing professional
        if (avatarFile && id) {
          const fileExt = avatarFile.name.split('.').pop();
          const filePath = `${currentClinic.id}/${id}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('professional-avatars')
            .upload(filePath, avatarFile, { upsert: true });
          
          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('professional-avatars')
              .getPublicUrl(filePath);
            avatarUrl = urlData.publicUrl;
          }
        }

        // Generate new slug if name changed
        const newSlug = name !== professional?.name 
          ? generateSlug(name) 
          : professional?.slug;

        const { data: updateData, error } = await supabase
          .from('professionals')
          .update({
            name: name.trim(),
            specialty: specialtyDisplay,
            council_type: councilType || null,
            registration_number: crm.trim() || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
            user_id: userId || null,
            avatar_url: avatarUrl,
            telemedicine_enabled: hasFeature('telemedicine') ? telemedicineEnabled : false,
            appointment_duration: appointmentDuration,
            slug: newSlug,
            address: address.trim() || null,
            city: city.trim() || null,
            state: state || null,
            zip_code: zipCode.replace(/\D/g, '') || null,
            whatsapp: whatsapp.replace(/\D/g, '') || null,
            bio: bio.trim() || null,
            education: education.trim() || null,
            experience: experience.trim() || null,
          })
          .eq('id', id)
          .select();

        if (error) throw error;

        if (!updateData || updateData.length === 0) {
          throw new Error('Não foi possível atualizar. Verifique suas permissões de administrador.');
        }

        // Save professional specialties
        if (id) {
          const result = await saveProfessionalSpecialties(id, specialtyIds);
          if (!result.success) {
            toast({
              title: "Aviso",
              description: "Profissional atualizado, mas houve um problema ao salvar especialidades.",
              variant: "destructive",
            });
          }
        }

        // Save professional procedures
        if (id) {
          await saveProfessionalProcedures(id);
        }

        // Save professional insurance plans
        if (id) {
          await saveProfessionalInsurancePlans(id);
        }

        toast({
          title: "Profissional atualizado",
          description: "As informações foram salvas com sucesso.",
        });
        
        // Refresh professional data to sync with database
        await fetchProfessional();
      }
    } catch (error: any) {
      // Handle professional limit error
      if (error.message?.includes('LIMITE_PROFISSIONAIS')) {
        const match = error.message.match(/LIMITE_PROFISSIONAIS: (.+)/);
        toast({
          title: "Limite de profissionais atingido",
          description: match ? match[1] : "Você atingiu o limite de profissionais do seu plano.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: isCreating ? "Erro ao cadastrar" : "Erro ao atualizar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
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

  // Only show "not found" for editing mode
  if (!isCreating && !professional) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Profissional não encontrado.</p>
        <Button variant="outline" onClick={() => navigate('/dashboard/professionals')} className="mt-4">
          Voltar para lista
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/professionals')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isCreating ? "Novo Profissional" : "Editar Profissional"}
            </h1>
            {!isCreating && professional && (
              <p className="text-muted-foreground">{professional.name}</p>
            )}
          </div>
        </div>
        {/* Auto-save status indicator - only show when editing */}
        {!isCreating && (
          <div className="flex items-center gap-2">
            {autoSaveStatus === 'saving' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Cloud className="h-4 w-4 animate-pulse" />
                <span>Salvando...</span>
              </div>
            )}
            {autoSaveStatus === 'saved' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Check className="h-4 w-4" />
                <span>Salvo</span>
              </div>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Profissional</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarPreview || undefined} />
                <AvatarFallback className="text-lg">
                  {name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <Label htmlFor="avatar" className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Alterar foto
                    </span>
                  </Button>
                </Label>
                <input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList className={`grid w-full ${isCreating ? 'grid-cols-4' : 'grid-cols-6'}`}>
                <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
                <TabsTrigger value="profile">Perfil Público</TabsTrigger>
                {!isCreating && <TabsTrigger value="schedule">Horários</TabsTrigger>}
                {!isCreating && <TabsTrigger value="procedures">Procedimentos</TabsTrigger>}
                <TabsTrigger value="insurance">Convênios</TabsTrigger>
                <TabsTrigger value="settings">Configurações</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor="name">Nome Completo *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`mt-1.5 ${errors.name ? "border-destructive" : ""}`}
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-destructive">{errors.name}</p>
                    )}
                  </div>
                  
                  <div className="sm:col-span-2">
                    <SpecialtySelector
                      selectedIds={specialtyIds}
                      onChange={setSpecialtyIds}
                      groupedSpecialties={groupedSpecialties}
                      loading={loadingSpecialties}
                      getSpecialtyById={getSpecialtyById}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="councilType">Conselho</Label>
                    <Select value={councilType} onValueChange={setCouncilType}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Selecione o conselho" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROFESSIONAL_COUNCILS.map((council) => (
                          <SelectItem key={council.id} value={council.id}>
                            {council.name} - {council.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="crm">Nº do Registro</Label>
                    <Input
                      id="crm"
                      value={crm}
                      onChange={(e) => setCrm(e.target.value)}
                      placeholder={councilType ? `${councilType} 12345/UF` : "12345/UF"}
                      className="mt-1.5"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="mt-1.5"
                    />
                  </div>
                  
                  <div className="sm:col-span-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                      className={`mt-1.5 ${errors.email ? "border-destructive" : ""}`}
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="profile" className="mt-4">
                <ProfessionalFormFields
                  address={address}
                  setAddress={setAddress}
                  city={city}
                  setCity={setCity}
                  state={state}
                  setState={setState}
                  zipCode={zipCode}
                  setZipCode={setZipCode}
                  whatsapp={whatsapp}
                  setWhatsapp={setWhatsapp}
                  bio={bio}
                  setBio={setBio}
                  education={education}
                  setEducation={setEducation}
                  experience={experience}
                  setExperience={setExperience}
                />
              </TabsContent>

              {!isCreating && professional && (
                <TabsContent value="schedule" className="mt-4">
                  <ScheduleTab
                    professionalId={professional.id}
                    professionalName={professional.name}
                    initialSchedule={professional.schedule as Record<string, { enabled: boolean; slots: { start: string; end: string }[] }> | null}
                    appointmentDuration={appointmentDuration}
                  />
                </TabsContent>
              )}

              <TabsContent value="procedures" className="mt-4 space-y-4">
                <div>
                  <Label>Procedimentos que este profissional realiza</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Selecione os procedimentos que serão exibidos na página pública do profissional
                  </p>
                  {procedures.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      Nenhum procedimento cadastrado. Cadastre procedimentos na página de Procedimentos.
                    </p>
                  ) : (
                    <div className="grid gap-2 max-h-[300px] overflow-y-auto border rounded-lg p-3">
                      {procedures.map((procedure) => (
                        <div key={procedure.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`proc-${procedure.id}`}
                            checked={selectedProcedureIds.includes(procedure.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedProcedureIds((prev) => [...prev, procedure.id]);
                              } else {
                                setSelectedProcedureIds((prev) =>
                                  prev.filter((id) => id !== procedure.id)
                                );
                              }
                            }}
                          />
                          <label
                            htmlFor={`proc-${procedure.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {procedure.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="insurance" className="mt-4 space-y-4">
                <div>
                  <Label>Convênios aceitos por este profissional</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Selecione os convênios que serão exibidos na página pública do profissional
                  </p>
                  {insurancePlans.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      Nenhum convênio cadastrado. Cadastre convênios na página de Convênios.
                    </p>
                  ) : (
                    <div className="grid gap-2 max-h-[300px] overflow-y-auto border rounded-lg p-3">
                      {insurancePlans.map((plan) => (
                        <div key={plan.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`ins-${plan.id}`}
                            checked={selectedInsuranceIds.includes(plan.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedInsuranceIds((prev) => [...prev, plan.id]);
                              } else {
                                setSelectedInsuranceIds((prev) =>
                                  prev.filter((id) => id !== plan.id)
                                );
                              }
                            }}
                          />
                          <label
                            htmlFor={`ins-${plan.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {plan.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="appointmentDuration">Intervalo de Atendimento</Label>
                  <Select value={String(appointmentDuration)} onValueChange={(val) => setAppointmentDuration(Number(val))}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 minutos</SelectItem>
                      <SelectItem value="10">10 minutos</SelectItem>
                      <SelectItem value="15">15 minutos</SelectItem>
                      <SelectItem value="20">20 minutos</SelectItem>
                      <SelectItem value="30">30 minutos</SelectItem>
                      <SelectItem value="45">45 minutos</SelectItem>
                      <SelectItem value="60">60 minutos</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Define o intervalo entre os horários disponíveis na configuração de horários
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="userId">Vincular a Usuário do Sistema</Label>
                  <Select value={userId || "none"} onValueChange={(val) => setUserId(val === "none" ? "" : val)}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecione (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {clinicUsers.map((u) => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {u.profile?.name || "Usuário sem nome"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Permite que o usuário acesse o portal do profissional
                  </p>
                </div>
                
                {hasFeature('telemedicine') && (
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <Label>Telemedicina</Label>
                      <p className="text-sm text-muted-foreground">
                        Habilitar consultas por vídeo
                      </p>
                    </div>
                    <Switch
                      checked={telemedicineEnabled}
                      onCheckedChange={setTelemedicineEnabled}
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/dashboard/professionals')}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || (isCreating && !canAddProfessional)}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isCreating ? "Cadastrar" : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
