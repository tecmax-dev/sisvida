import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useSpecialties, Specialty } from "@/hooks/useSpecialties";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { SpecialtySelector } from "@/components/professionals/SpecialtySelector";
import { ProfessionalFormFields } from "@/components/professionals/ProfessionalFormFields";
import { z } from "zod";
import { Json } from "@/integrations/supabase/types";

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
  const navigate = useNavigate();
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const { hasFeature } = usePlanFeatures();
  const {
    loading: loadingSpecialties,
    groupedSpecialties,
    saveProfessionalSpecialties,
    fetchProfessionalSpecialties,
    getSpecialtyById,
  } = useSpecialties();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [clinicUsers, setClinicUsers] = useState<ClinicUser[]>([]);
  
  // Form state
  const [name, setName] = useState("");
  const [specialtyIds, setSpecialtyIds] = useState<string[]>([]);
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

  useEffect(() => {
    if (currentClinic && id) {
      fetchProfessional();
      fetchClinicUsers();
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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setAvatarPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

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

    if (!currentClinic || !id || !professional) return;

    setSaving(true);
    setErrors({});

    try {
      // Get display name from selected specialties
      const specialtyNames = specialtyIds
        .map(specId => getSpecialtyById(specId)?.name)
        .filter((n): n is string => !!n);
      const specialtyDisplay = specialtyNames.join(', ') || null;

      // Upload new avatar if selected
      let avatarUrl = professional.avatar_url;
      if (avatarFile) {
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
      const newSlug = name !== professional.name 
        ? generateSlug(name) 
        : professional.slug;

      const { data: updateData, error } = await supabase
        .from('professionals')
        .update({
          name: name.trim(),
          specialty: specialtyDisplay,
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

      // Verificar se alguma linha foi realmente atualizada
      if (!updateData || updateData.length === 0) {
        throw new Error('Não foi possível atualizar. Verifique suas permissões de administrador.');
      }

      // Save professional specialties
      const result = await saveProfessionalSpecialties(id, specialtyIds);
      if (!result.success) {
        toast({
          title: "Aviso",
          description: "Profissional atualizado, mas houve um problema ao salvar especialidades.",
          variant: "destructive",
        });
      }

      toast({
        title: "Profissional atualizado",
        description: "As informações foram salvas com sucesso.",
      });

      navigate('/dashboard/professionals');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!professional) {
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/professionals')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Editar Profissional</h1>
          <p className="text-muted-foreground">{professional.name}</p>
        </div>
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

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
                <TabsTrigger value="profile">Perfil Público</TabsTrigger>
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
                    <Label htmlFor="crm">Registro Profissional</Label>
                    <Input
                      id="crm"
                      value={crm}
                      onChange={(e) => setCrm(e.target.value)}
                      placeholder="CRM, CRO, etc."
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

              <TabsContent value="settings" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="appointmentDuration">Intervalo de Atendimento</Label>
                  <Select value={String(appointmentDuration)} onValueChange={(val) => setAppointmentDuration(Number(val))}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
