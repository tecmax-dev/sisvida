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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function ProfessionalProfile() {
  const { clinicSlug, professionalSlug } = useParams();
  const { toast } = useToast();

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [insurancePlans, setInsurancePlans] = useState<InsurancePlan[]>([]);
  const [existingAppointments, setExistingAppointments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
        .select('id, name, slug, phone, address, logo_url')
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

  const selectedProcedurePrice = useMemo(() => {
    if (selectedProcedure) {
      const procedure = procedures.find(p => p.id === selectedProcedure);
      return procedure?.price || 0;
    }
    return 0;
  }, [selectedProcedure, procedures]);

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
    
    daySchedule.slots.forEach(slot => {
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
          procedureId: selectedProcedure || null,
          insurancePlanId: selectedInsurance || null,
          durationMinutes: appointmentDuration,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar agendamento');

      toast({ title: "Agendamento realizado!", description: "Você receberá uma confirmação em breve." });
      
      // Reset form
      setSelectedDate(null);
      setSelectedTime("");
      setPatientName("");
      setPatientPhone("");
      setPatientEmail("");
      setSelectedProcedure("");
    } catch (error: any) {
      toast({ title: "Erro ao agendar", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const getGoogleStreetViewUrl = () => {
    if (professional?.latitude && professional?.longitude) {
      return `https://www.google.com/maps/embed?pb=!4v1!6m8!1m7!1s!2m2!1d${professional.latitude}!2d${professional.longitude}!3f0!4f0!5f0.7820865974627469`;
    }
    if (professional?.address) {
      const query = encodeURIComponent(`${professional.address}, ${professional.city || ''}, ${professional.state || ''}`);
      return `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${query}`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clinic || !professional) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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

  const streetViewUrl = getGoogleStreetViewUrl();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
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

      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Professional Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-6">
                  <Avatar className="w-32 h-32 border-4 border-primary/20">
                    <AvatarImage src={professional.avatar_url || undefined} alt={professional.name} />
                    <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                      {professional.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-foreground">{professional.name}</h1>
                    {professional.specialty && (
                      <p className="text-primary font-medium">{professional.specialty}</p>
                    )}
                    {professional.registration_number && (
                      <Badge variant="secondary" className="mt-2">
                        {professional.registration_number}
                      </Badge>
                    )}
                    
                    <div className="mt-4 flex flex-wrap gap-3">
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
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="info">Informações Gerais</TabsTrigger>
                <TabsTrigger value="experience">Experiência</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-6 mt-4">
                {/* Address & Map */}
                {(professional.address || professional.city) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <MapPin className="h-5 w-5 text-primary" />
                        Consultório
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="font-medium">{professional.name}</p>
                        {professional.address && <p className="text-muted-foreground">{professional.address}</p>}
                        {(professional.city || professional.state) && (
                          <p className="text-muted-foreground">
                            {[professional.city, professional.state].filter(Boolean).join(' - ')}
                          </p>
                        )}
                        {professional.zip_code && (
                          <p className="text-muted-foreground">CEP: {professional.zip_code}</p>
                        )}
                      </div>
                      
                      {/* Google Street View / Map */}
                      {streetViewUrl && (
                        <div className="rounded-lg overflow-hidden border">
                          <iframe
                            src={streetViewUrl}
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

                      {professional.phone && (
                        <div className="flex items-center gap-2 pt-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{professional.phone}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* About */}
                {professional.bio && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <User className="h-5 w-5 text-primary" />
                        Sobre Mim
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground whitespace-pre-line">{professional.bio}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Education */}
                {professional.education && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <GraduationCap className="h-5 w-5 text-primary" />
                        Formação
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground whitespace-pre-line">{professional.education}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="experience" className="mt-4">
                {professional.experience ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Briefcase className="h-5 w-5 text-primary" />
                        Experiência Profissional
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground whitespace-pre-line">{professional.experience}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">Nenhuma experiência cadastrada</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Booking Widget (Sticky) */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              <Card className="border-primary/20 shadow-lg">
                <CardHeader className="bg-primary/5 border-b">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    <CardTitle className="text-lg">Agende uma Consulta</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* Procedure Select */}
                  {procedures.length > 0 && (
                    <div className="space-y-2">
                      <Label>Procedimento</Label>
                      <Select value={selectedProcedure} onValueChange={setSelectedProcedure}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {procedures.map((proc) => (
                            <SelectItem key={proc.id} value={proc.id}>
                              {proc.name} - R$ {proc.price.toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Calendar */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Selecione uma data
                    </Label>
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-3">
                        <button
                          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                          className="p-1 hover:bg-secondary rounded"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="font-medium text-sm">
                          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </span>
                        <button
                          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                          className="p-1 hover:bg-secondary rounded"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-7 gap-1 mb-1">
                        {weekDays.map(day => (
                          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                            {day}
                          </div>
                        ))}
                      </div>
                      
                      <div className="grid grid-cols-7 gap-1">
                        {getDaysInMonth(currentMonth).map((date, i) => (
                          <div key={i} className="aspect-square">
                            {date && (
                              <button
                                onClick={() => !isDateDisabled(date) && setSelectedDate(date)}
                                disabled={isDateDisabled(date)}
                                className={cn(
                                  "w-full h-full rounded text-sm flex items-center justify-center transition-colors",
                                  isDateDisabled(date) && "text-muted-foreground/40 cursor-not-allowed",
                                  !isDateDisabled(date) && "hover:bg-primary/10",
                                  selectedDate?.toDateString() === date.toDateString() && "bg-primary text-primary-foreground hover:bg-primary"
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
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Selecione um horário
                      </Label>
                      {availableTimeSlots.length > 0 ? (
                        <div className="grid grid-cols-4 gap-2">
                          {availableTimeSlots.map((time) => (
                            <button
                              key={time}
                              onClick={() => setSelectedTime(time)}
                              className={cn(
                                "py-2 text-sm rounded border transition-colors",
                                selectedTime === time
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "hover:border-primary hover:bg-primary/5"
                              )}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum horário disponível nesta data
                        </p>
                      )}
                    </div>
                  )}

                  {/* Insurance */}
                  {insurancePlans.length > 0 && (
                    <div className="space-y-2">
                      <Label>Convênio</Label>
                      <Select value={selectedInsurance} onValueChange={setSelectedInsurance}>
                        <SelectTrigger>
                          <SelectValue placeholder="Particular" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="particular">Particular</SelectItem>
                          {insurancePlans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Price Display */}
                  {selectedProcedurePrice > 0 && (
                    <div className="bg-primary/5 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Valor:</span>
                        <span className="text-lg font-bold text-primary">
                          R$ {selectedProcedurePrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Appointment Type */}
                  <div className="space-y-2">
                    <Label>É sua primeira consulta?</Label>
                    <div className="flex gap-2">
                      {appointmentTypes.map((type) => (
                        <button
                          key={type.value}
                          onClick={() => setSelectedType(type.value)}
                          className={cn(
                            "flex-1 py-2 text-sm rounded border transition-colors",
                            selectedType === type.value
                              ? "bg-primary text-primary-foreground border-primary"
                              : "hover:border-primary"
                          )}
                        >
                          {type.value === "first_visit" ? "Sim" : "Não"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Patient Info */}
                  {selectedTime && (
                    <div className="space-y-3 border-t pt-4">
                      <div className="space-y-2">
                        <Label>Seu nome *</Label>
                        <Input
                          value={patientName}
                          onChange={(e) => setPatientName(e.target.value)}
                          placeholder="Nome completo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone *</Label>
                        <Input
                          value={patientPhone}
                          onChange={(e) => setPatientPhone(formatPhone(e.target.value))}
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email (opcional)</Label>
                        <Input
                          type="email"
                          value={patientEmail}
                          onChange={(e) => setPatientEmail(e.target.value)}
                          placeholder="seu@email.com"
                        />
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    onClick={handleSubmit}
                    disabled={!selectedDate || !selectedTime || !patientName || !patientPhone || submitting}
                    className="w-full"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Agendando...
                      </>
                    ) : (
                      "Confirmar Agendamento"
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
