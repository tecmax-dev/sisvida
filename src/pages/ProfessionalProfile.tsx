import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { 
  Calendar, 
  Clock, 
  Phone, 
  MapPin, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  Building2,
  GraduationCap,
  Briefcase,
  User,
  MessageCircle,
  Mail,
  Info,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/layout/Logo";

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const appointmentTypes = [
  { value: "first_visit", label: "Primeira Consulta" },
  { value: "return", label: "Retorno" },
];

interface Clinic {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  map_view_type: string | null;
  custom_map_embed_url: string | null;
}

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  registration_number: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  education: string | null;
  experience: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
  appointment_duration: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schedule: any;
}

interface Procedure {
  id: string;
  name: string;
  price: number;
  duration_minutes: number | null;
}

interface InsurancePlan {
  id: string;
  name: string;
}

interface ProcedureInsurancePrice {
  procedure_id: string;
  insurance_plan_id: string;
  price: number;
}

export default function ProfessionalProfile() {
  const { clinicSlug, professionalSlug } = useParams();
  const { toast } = useToast();

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [insurancePlans, setInsurancePlans] = useState<InsurancePlan[]>([]);
  const [procedureInsurancePrices, setProcedureInsurancePrices] = useState<ProcedureInsurancePrice[]>([]);
  const [existingAppointments, setExistingAppointments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Calendar & Form state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedProcedure, setSelectedProcedure] = useState("");
  const [selectedType, setSelectedType] = useState("first_visit");
  const [selectedInsurance, setSelectedInsurance] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientCpf, setPatientCpf] = useState("");
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [patientFound, setPatientFound] = useState(false);
  const [cpfError, setCpfError] = useState("");

  useEffect(() => {
    fetchData();
  }, [clinicSlug, professionalSlug]);

  useEffect(() => {
    if (clinic && professional && selectedDate) {
      fetchExistingAppointments();
    }
  }, [clinic, professional, selectedDate]);

  const fetchData = async () => {
    if (!clinicSlug) return;
    setLoading(true);

    try {
      // Fetch clinic
      const { data: clinicData, error: clinicError } = await supabase
        .from('clinics')
        .select('id, name, slug, phone, address, logo_url, map_view_type, custom_map_embed_url')
        .eq('slug', clinicSlug)
        .single();

      if (clinicError || !clinicData) {
        toast({ title: "Clínica não encontrada", variant: "destructive" });
        return;
      }

      setClinic(clinicData);

      // Fetch professional by slug or id
      let professionalQuery = supabase
        .from('professionals')
        .select('*')
        .eq('clinic_id', clinicData.id)
        .eq('is_active', true);

      if (professionalSlug) {
        professionalQuery = professionalQuery.eq('slug', professionalSlug);
      }

      const { data: profData } = await professionalQuery.maybeSingle();

      if (!profData && professionalSlug) {
        // Try fetching by ID if slug doesn't exist
        const { data: profById } = await supabase
          .from('professionals')
          .select('*')
          .eq('clinic_id', clinicData.id)
          .eq('id', professionalSlug)
          .eq('is_active', true)
          .maybeSingle();
        
        if (profById) {
          setProfessional(profById as Professional);
        }
      } else if (profData) {
        setProfessional(profData as Professional);
      }

      // Fetch procedures
      const { data: proceduresData } = await supabase
        .from('procedures')
        .select('id, name, price, duration_minutes')
        .eq('clinic_id', clinicData.id)
        .eq('is_active', true);

      setProcedures(proceduresData || []);

      // Fetch procedure insurance prices
      if (proceduresData && proceduresData.length > 0) {
        const procedureIds = proceduresData.map(p => p.id);
        const { data: pricesData } = await supabase
          .from('procedure_insurance_prices')
          .select('procedure_id, insurance_plan_id, price')
          .in('procedure_id', procedureIds);
        
        setProcedureInsurancePrices(pricesData || []);
      }

      // Fetch insurance plans
      const { data: insuranceData } = await supabase
        .from('insurance_plans')
        .select('id, name')
        .eq('clinic_id', clinicData.id)
        .eq('is_active', true);

      setInsurancePlans(insuranceData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingAppointments = async () => {
    if (!clinic || !professional || !selectedDate) return;

    const dateStr = selectedDate.toISOString().split('T')[0];
    
    const { data } = await supabase
      .from('appointments')
      .select('start_time')
      .eq('clinic_id', clinic.id)
      .eq('professional_id', professional.id)
      .eq('appointment_date', dateStr)
      .in('status', ['scheduled', 'confirmed']);

    setExistingAppointments(data?.map(a => a.start_time.substring(0, 5)) || []);
  };

  const appointmentDuration = useMemo(() => {
    if (selectedProcedure) {
      const procedure = procedures.find(p => p.id === selectedProcedure);
      if (procedure?.duration_minutes) return procedure.duration_minutes;
    }
    return professional?.appointment_duration || 30;
  }, [selectedProcedure, professional, procedures]);

  // Helper function to get price based on selected insurance
  const getProcedurePrice = (procedureId: string, defaultPrice: number): number => {
    if (!selectedInsurance || selectedInsurance === "particular") return defaultPrice;
    
    // Check if the selected plan is "Particular" by ID
    const selectedPlan = insurancePlans.find(p => p.id === selectedInsurance);
    if (selectedPlan?.name.toLowerCase() === "particular") return defaultPrice;
    
    const insurancePrice = procedureInsurancePrices.find(
      p => p.procedure_id === procedureId && p.insurance_plan_id === selectedInsurance
    );
    
    return insurancePrice ? insurancePrice.price : defaultPrice;
  };

  const selectedProcedurePrice = useMemo(() => {
    if (selectedProcedure) {
      const procedure = procedures.find(p => p.id === selectedProcedure);
      if (procedure) {
        return getProcedurePrice(procedure.id, procedure.price);
      }
    }
    return 0;
  }, [selectedProcedure, procedures, selectedInsurance, procedureInsurancePrices]);

  const availableTimeSlots = useMemo(() => {
    if (!selectedDate || !professional) return [];
    
    const dayIndex = selectedDate.getDay();
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = dayKeys[dayIndex];
    
    const schedule = professional.schedule;
    if (!schedule || !schedule[dayKey] || !schedule[dayKey].enabled) {
      return [];
    }
    
    const daySchedule = schedule[dayKey];
    const duration = appointmentDuration;
    const slots: string[] = [];
    
    daySchedule.slots.forEach((slot: { start: string; end: string }) => {
      const [startHour, startMin] = slot.start.split(':').map(Number);
      const [endHour, endMin] = slot.end.split(':').map(Number);
      
      let current = startHour * 60 + startMin;
      const end = endHour * 60 + endMin;
      
      while (current + duration <= end) {
        const hour = Math.floor(current / 60);
        const min = current % 60;
        slots.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
        current += duration;
      }
    });
    
    return slots.filter(slot => !existingAppointments.includes(slot));
  }, [selectedDate, professional, existingAppointments, appointmentDuration]);

  const isDayAvailable = (date: Date) => {
    if (!professional?.schedule) return true;
    
    const dayIndex = date.getDay();
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = dayKeys[dayIndex];
    
    return professional.schedule[dayKey]?.enabled || false;
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return true;
    if (!isDayAvailable(date)) return true;
    return false;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const validateCpf = (cpf: string): boolean => {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cleanCpf)) return false;
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCpf[i]) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCpf[9])) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCpf[i]) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCpf[10])) return false;
    
    return true;
  };

  const searchPatientByCpf = async (cpf: string) => {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11 || !clinic) return;
    
    if (!validateCpf(cleanCpf)) {
      setCpfError("CPF inválido");
      return;
    }
    
    setCpfError("");
    setSearchingPatient(true);
    setPatientFound(false);
    
    try {
      const { data } = await supabase
        .from('patients')
        .select('name, phone, email')
        .eq('clinic_id', clinic.id)
        .eq('cpf', cleanCpf)
        .maybeSingle();
      
      if (data) {
        setPatientName(data.name);
        setPatientPhone(formatPhone(data.phone));
        setPatientEmail(data.email || '');
        setPatientFound(true);
        toast({ title: "Cadastro encontrado!", description: "Seus dados foram preenchidos automaticamente." });
      }
    } finally {
      setSearchingPatient(false);
    }
  };

  useEffect(() => {
    const cleanCpf = patientCpf.replace(/\D/g, '');
    if (cleanCpf.length === 11 && clinic) {
      const timeoutId = setTimeout(() => {
        searchPatientByCpf(patientCpf);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setPatientFound(false);
      setCpfError("");
    }
  }, [patientCpf, clinic]);

  const formatZipCode = (zipCode: string | null) => {
    if (!zipCode) return null;
    const numbers = zipCode.replace(/\D/g, '');
    if (numbers.length === 8) {
      return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
    }
    return zipCode;
  };

  const handleSubmit = async () => {
    if (!clinic || !professional || !selectedDate || !selectedTime || !patientName || !patientPhone) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const phoneClean = patientPhone.replace(/\D/g, '');

      const { data, error } = await supabase.functions.invoke('create-public-booking', {
        body: {
          clinicId: clinic.id,
          professionalId: professional.id,
          date: dateStr,
          time: selectedTime,
          type: selectedType,
          patientName: patientName.trim(),
          patientPhone: phoneClean,
          patientEmail: patientEmail?.trim() || null,
          patientCpf: patientCpf?.replace(/\D/g, '') || null,
          procedureId: selectedProcedure || null,
          insurancePlanId: selectedInsurance || null,
          durationMinutes: appointmentDuration,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar agendamento');

      setSuccess(true);
      toast({ title: "Agendamento realizado!", description: "Você receberá uma confirmação em breve." });
    } catch (error: any) {
      toast({ title: "Erro ao agendar", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const getGoogleMapUrl = () => {
    if (professional?.latitude && professional?.longitude) {
      return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1000!2d${professional.longitude}!3d${professional.latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zM!5e0!3m2!1spt-BR!2sbr!4v1`;
    }
    if (professional?.address) {
      const query = encodeURIComponent(`${professional.address}, ${professional.city || ''}, ${professional.state || ''}`);
      return `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${query}`;
    }
    return null;
  };

  const getStreetViewUrl = () => {
    // Street View REQUER coordenadas - não aceita endereço texto
    if (professional?.latitude && professional?.longitude) {
      return `https://www.google.com/maps/embed?pb=!4v1!6m8!1m7!1s!2m2!1d${professional.latitude}!2d${professional.longitude}!3f0!4f0!5f0.75`;
    }
    // Sem coordenadas, Street View não é possível - retornar null para fallback
    return null;
  };

  const getGoogleMapsLink = () => {
    if (professional?.latitude && professional?.longitude) {
      return `https://www.google.com/maps?q=${professional.latitude},${professional.longitude}`;
    }
    if (professional?.address) {
      const query = encodeURIComponent(`${professional.address}, ${professional.city || ''}, ${professional.state || ''}`);
      return `https://www.google.com/maps/search/${query}`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clinic || !professional) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Profissional não encontrado</h2>
            <p className="text-muted-foreground">Verifique o link de acesso</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Agendamento Confirmado!</h2>
            <p className="text-muted-foreground mb-6">
              Você receberá uma confirmação por WhatsApp em breve.
            </p>
            <Button onClick={() => setSuccess(false)} variant="outline">
              Fazer outro agendamento
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mapUrl = getGoogleMapUrl();
  const streetViewUrl = getStreetViewUrl();
  const googleMapsLink = getGoogleMapsLink();
  const configuredMapViewType = clinic.map_view_type || 'streetview';
  const customMapEmbedUrl = clinic.custom_map_embed_url;
  
  // Extrai a URL src do iframe se o usuário colou o código completo
  const extractIframeSrc = (input: string | null): string | null => {
    if (!input) return null;
    // Se já é uma URL direta, retorna
    if (input.startsWith('http')) return input;
    // Tenta extrair src do iframe
    const match = input.match(/src=["']([^"']+)["']/);
    return match ? match[1] : null;
  };
  
  const customEmbedSrc = extractIframeSrc(customMapEmbedUrl);
  
  // Fallback inteligente: se Street View foi selecionado mas não há coordenadas, usar mapa normal
  const mapViewType = (configuredMapViewType === 'streetview' || configuredMapViewType === 'both') && !streetViewUrl
    ? 'map' // Fallback para mapa quando Street View não está disponível
    : configuredMapViewType;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {clinic.logo_url ? (
              <img src={clinic.logo_url} alt={clinic.name} className="h-10 w-auto" />
            ) : (
              <Logo size="sm" />
            )}
            <span className="text-lg font-semibold text-foreground">{clinic.name}</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Column - Professional Info (7/12 ≈ 58%) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Profile Header Card */}
            <Card className="overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5">
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <Avatar className="w-24 h-24 border-4 border-background shadow-md flex-shrink-0">
                    <AvatarImage src={professional.avatar_url || undefined} alt={professional.name} />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground font-semibold">
                      {professional.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1.5">
                    <h1 className="text-xl font-bold text-foreground">{professional.name}</h1>
                    {professional.specialty && (
                      <p className="text-primary font-medium">{professional.specialty}</p>
                    )}
                    {professional.registration_number && (
                      <p className="text-sm text-muted-foreground">
                        Número de registro: {professional.registration_number}
                      </p>
                    )}
                    
                    {/* Contact Info Popover */}
                    <div className="pt-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Info className="h-4 w-4" />
                            Informações de contato
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72" align="start">
                          <div className="space-y-3">
                            <h4 className="font-medium text-sm">Contato</h4>
                            {professional.phone && (
                              <a href={`tel:${professional.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                                <Phone className="h-4 w-4" />
                                {professional.phone}
                              </a>
                            )}
                            {professional.whatsapp && (
                              <a 
                                href={`https://wa.me/55${professional.whatsapp.replace(/\D/g, '')}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700"
                              >
                                <MessageCircle className="h-4 w-4" />
                                WhatsApp
                              </a>
                            )}
                            {professional.email && (
                              <a href={`mailto:${professional.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                                <Mail className="h-4 w-4" />
                                {professional.email}
                              </a>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="w-full grid grid-cols-2 h-10 bg-muted/50">
                <TabsTrigger value="info" className="gap-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Informações Gerais
                </TabsTrigger>
                <TabsTrigger value="experience" className="gap-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Experiência
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4">
                {/* Address & Map */}
                {(professional.address || professional.city || clinic.address) && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Building2 className="h-5 w-5 text-primary" />
                        Consultório
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{clinic.name}</p>
                        {professional.address && (
                          <p className="text-muted-foreground">{professional.address}</p>
                        )}
                        {(professional.city || professional.state) && (
                          <p className="text-muted-foreground">
                            {[professional.city, professional.state].filter(Boolean).join(' - ')}
                          </p>
                        )}
                        {professional.zip_code && (
                          <p className="text-muted-foreground text-sm">
                            CEP: {formatZipCode(professional.zip_code)}
                          </p>
                        )}
                      </div>
                      
                      {/* Street View / Map based on clinic config */}
                      {mapViewType !== 'none' && (
                        <>
                          {/* Custom Embed URL */}
                          {mapViewType === 'custom' && customEmbedSrc && (
                            <div className="rounded-lg overflow-hidden border shadow-sm">
                              <iframe
                                src={customEmbedSrc}
                                width="100%"
                                height="300"
                                style={{ border: 0 }}
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                title="Localização do consultório"
                              />
                            </div>
                          )}

                          {/* Street View */}
                          {(mapViewType === 'streetview' || mapViewType === 'both') && streetViewUrl && (
                            <div className="rounded-lg overflow-hidden border shadow-sm">
                              <iframe
                                src={streetViewUrl}
                                width="100%"
                                height="300"
                                style={{ border: 0 }}
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                title="Street View do consultório"
                              />
                            </div>
                          )}
                          
                          {/* Regular Map */}
                          {mapViewType === 'map' && mapUrl && (
                            <div className="rounded-lg overflow-hidden border shadow-sm">
                              <iframe
                                src={mapUrl}
                                width="100%"
                                height="300"
                                style={{ border: 0 }}
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                title="Localização do consultório"
                              />
                            </div>
                          )}
                          
                          {/* Link to Google Maps when showing both */}
                          {mapViewType === 'both' && googleMapsLink && (
                            <a 
                              href={googleMapsLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
                            >
                              <MapPin className="h-5 w-5" />
                              <span className="font-medium">Ver no Google Maps</span>
                            </a>
                          )}
                        </>
                      )}

                      {/* WhatsApp */}
                      {professional.whatsapp && (
                        <a 
                          href={`https://wa.me/55${professional.whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors"
                        >
                          <MessageCircle className="h-5 w-5" />
                          <span className="font-medium">Fale pelo WhatsApp</span>
                        </a>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="experience" className="mt-4 space-y-4">
                {/* About Me */}
                {professional.bio && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <User className="h-5 w-5 text-primary" />
                        Sobre Mim
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground whitespace-pre-wrap">{professional.bio}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Education */}
                {professional.education && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <GraduationCap className="h-5 w-5 text-primary" />
                        Formação
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground whitespace-pre-wrap">{professional.education}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Experience */}
                {professional.experience && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Briefcase className="h-5 w-5 text-primary" />
                        Experiência Profissional
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground whitespace-pre-wrap">{professional.experience}</p>
                    </CardContent>
                  </Card>
                )}

                {!professional.bio && !professional.education && !professional.experience && (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma informação de experiência disponível</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Booking Widget (5/12 ≈ 42%) */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-20">
              <Card className="shadow-md border border-border">
                <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-t-lg py-4">
                  <CardTitle className="text-lg font-semibold">Agende uma Consulta</CardTitle>
                  <p className="text-sm text-primary-foreground/80 mt-0.5">Consulte especialidades da maneira mais conveniente</p>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* Insurance Plan - FIRST so price updates for procedures */}
                  {insurancePlans.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Convênio</Label>
                      <ResponsiveSelect
                        value={selectedInsurance}
                        onValueChange={setSelectedInsurance}
                        placeholder="Particular"
                        className="mt-1.5"
                        options={[
                          { value: "particular", label: "Particular" },
                          ...insurancePlans
                            .filter((plan) => plan.name.toLowerCase() !== "particular")
                            .map((plan) => ({
                              value: plan.id,
                              label: plan.name
                            }))
                        ]}
                      />
                    </div>
                  )}

                  {/* Procedure Selection - Shows dynamic price based on insurance */}
                  {procedures.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Procedimento</Label>
                      <ResponsiveSelect
                        value={selectedProcedure}
                        onValueChange={setSelectedProcedure}
                        placeholder="Selecione (opcional)"
                        className="mt-1.5"
                        options={procedures.map((procedure) => {
                          const price = getProcedurePrice(procedure.id, procedure.price);
                          return {
                            value: procedure.id,
                            label: `${procedure.name}${price > 0 ? ` - R$ ${price.toFixed(2)}` : ''}`
                          };
                        })}
                      />
                    </div>
                  )}

                  {/* Calendar */}
                  <div>
                    <Label className="text-sm font-medium">Data da Consulta</Label>
                    <div className="mt-2 border rounded-lg p-3 bg-muted/30">
                      <div className="flex items-center justify-between mb-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="font-medium text-sm">
                          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {weekDays.map((day) => (
                          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {getDaysInMonth(currentMonth).map((date, index) => (
                          <div key={index} className="aspect-square">
                            {date && (
                              <button
                                onClick={() => !isDateDisabled(date) && setSelectedDate(date)}
                                disabled={isDateDisabled(date)}
                                className={cn(
                                  "w-full h-full rounded-md text-sm font-medium transition-colors",
                                  isDateDisabled(date) 
                                    ? "text-muted-foreground/40 cursor-not-allowed" 
                                    : "hover:bg-primary/10",
                                  selectedDate?.toDateString() === date.toDateString() 
                                    ? "bg-primary text-primary-foreground hover:bg-primary" 
                                    : ""
                                )}
                              >
                                {date.getDate()}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Time Slots */}
                  {selectedDate && (
                    <div>
                      <Label className="text-sm font-medium">Horário</Label>
                      {availableTimeSlots.length > 0 ? (
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          {availableTimeSlots.map((time) => (
                            <button
                              key={time}
                              onClick={() => setSelectedTime(time)}
                              className={cn(
                                "py-2 px-3 rounded-md text-sm font-medium border transition-colors",
                                selectedTime === time
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border hover:border-primary hover:bg-primary/5"
                              )}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Nenhum horário disponível para esta data
                        </p>
                      )}
                    </div>
                  )}
                  {/* Appointment Type */}
                  <div>
                    <Label className="text-sm font-medium">Tipo de Consulta</Label>
                    <ResponsiveSelect
                      value={selectedType}
                      onValueChange={setSelectedType}
                      placeholder="Selecione o tipo"
                      className="mt-1.5"
                      options={appointmentTypes.map((type) => ({
                        value: type.value,
                        label: type.label
                      }))}
                    />
                  </div>

                  {/* Price Display */}
                  {selectedProcedurePrice > 0 && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Valor:</span>
                        <span className="text-lg font-bold text-primary">
                          R$ {selectedProcedurePrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Patient Info */}
                  <div className="space-y-3 pt-2 border-t">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Seus Dados
                    </h4>
                    <div>
                      <Label htmlFor="patientCpf" className="text-sm">CPF</Label>
                      <div className="relative">
                        <Input
                          id="patientCpf"
                          value={patientCpf}
                          onChange={(e) => setPatientCpf(formatCpf(e.target.value))}
                          placeholder="000.000.000-00"
                          maxLength={14}
                          className={cn("mt-1 pr-10", cpfError && "border-destructive")}
                        />
                        {searchingPatient && (
                          <Loader2 className="absolute right-3 top-1/2 translate-y-[-25%] h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {patientFound && !searchingPatient && (
                          <CheckCircle2 className="absolute right-3 top-1/2 translate-y-[-25%] h-4 w-4 text-green-500" />
                        )}
                      </div>
                      {cpfError ? (
                        <p className="text-xs text-destructive mt-1">{cpfError}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">
                          Digite seu CPF para buscar cadastro
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="patientName" className="text-sm">Nome completo *</Label>
                      <Input
                        id="patientName"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="Seu nome"
                        className="mt-1"
                        disabled={patientFound}
                      />
                    </div>
                    <div>
                      <Label htmlFor="patientPhone" className="text-sm">Telefone / WhatsApp *</Label>
                      <Input
                        id="patientPhone"
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(formatPhone(e.target.value))}
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                        className="mt-1"
                        disabled={patientFound}
                      />
                    </div>
                    <div>
                      <Label htmlFor="patientEmail" className="text-sm">Email (opcional)</Label>
                      <Input
                        id="patientEmail"
                        type="email"
                        value={patientEmail}
                        onChange={(e) => setPatientEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="mt-1"
                        disabled={patientFound}
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !selectedDate || !selectedTime || !patientName || !patientPhone}
                    className="w-full h-12 text-base font-semibold"
                    size="lg"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Agendando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-5 w-5" />
                        Confirmar Agendamento
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}