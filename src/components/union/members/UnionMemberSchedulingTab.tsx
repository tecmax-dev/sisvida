import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

import { 
  User,
  Calendar,
  Clock,
  ChevronRight,
  Stethoscope,
  History,
  Plus,
  FileText,
  CalendarDays,
  Loader2,
} from "lucide-react";

interface Professional {
  id: string;
  name: string;
  photo_url: string | null;
  specialties: Array<{
    id: string;
    name: string;
    category: string;
  }>;
}

interface SpecialtyTab {
  id: string;
  name: string;
  count: number;
}

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  notes: string | null;
  professional: {
    id: string;
    name: string;
  } | null;
  procedure: {
    id: string;
    name: string;
  } | null;
}

interface UnionMemberSchedulingTabProps {
  patientId: string;
  patientName: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Agendado", variant: "default" },
  confirmed: { label: "Confirmado", variant: "secondary" },
  in_progress: { label: "Em Atendimento", variant: "default" },
  completed: { label: "Concluído", variant: "outline" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  no_show: { label: "Não Compareceu", variant: "destructive" },
};

const typeLabels: Record<string, string> = {
  first_visit: "Primeira Consulta",
  follow_up: "Retorno",
  procedure: "Procedimento",
  emergency: "Emergência",
  telemedicine: "Telemedicina",
};

export function UnionMemberSchedulingTab({ patientId, patientName }: UnionMemberSchedulingTabProps) {
  const { currentClinic } = useAuth();
  const navigate = useNavigate();
  
  // Main tab state
  const [mainTab, setMainTab] = useState<"history" | "schedule">("history");
  
  // Appointments state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  
  // Professionals/scheduling state
  const [activeSpecialty, setActiveSpecialty] = useState<string | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [professionalsLoading, setProfessionalsLoading] = useState(true);

  // Fetch appointments
  useEffect(() => {
    if (currentClinic?.id && patientId) {
      fetchAppointments();
    }
  }, [currentClinic?.id, patientId]);

  // Fetch professionals
  useEffect(() => {
    if (currentClinic?.id) {
      fetchProfessionals();
    }
  }, [currentClinic?.id]);

  const fetchAppointments = async () => {
    if (!currentClinic?.id || !patientId) return;
    
    setAppointmentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          appointment_date,
          start_time,
          end_time,
          status,
          type,
          notes,
          professional:professionals(id, name),
          procedure:procedures(id, name)
        `)
        .eq("patient_id", patientId)
        .eq("clinic_id", currentClinic.id)
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: false });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  const fetchProfessionals = async () => {
    if (!currentClinic?.id) return;
    
    setProfessionalsLoading(true);
    try {
      const { data, error } = await supabase
        .from("professionals")
        .select(`
          id,
          name,
          photo_url,
          professional_specialties (
            specialty:specialties (
              id,
              name,
              category
            )
          )
        `)
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      const formattedProfessionals: Professional[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        photo_url: p.photo_url,
        specialties: (p.professional_specialties || [])
          .filter((ps: any) => ps.specialty)
          .map((ps: any) => ({
            id: ps.specialty.id,
            name: ps.specialty.name,
            category: ps.specialty.category,
          })),
      }));

      setProfessionals(formattedProfessionals);
    } catch (error) {
      console.error("Error fetching professionals:", error);
    } finally {
      setProfessionalsLoading(false);
    }
  };

  // Appointments logic
  const today = startOfDay(new Date());
  
  const upcomingAppointments = useMemo(() => 
    appointments.filter((apt) => {
      const aptDate = parseISO(apt.appointment_date);
      return !isBefore(aptDate, today) && apt.status !== "cancelled" && apt.status !== "no_show";
    }), [appointments, today]
  );

  const pastAppointments = useMemo(() => 
    appointments.filter((apt) => {
      const aptDate = parseISO(apt.appointment_date);
      return isBefore(aptDate, today) || apt.status === "cancelled" || apt.status === "no_show";
    }), [appointments, today]
  );

  // Specialty tabs logic
  const specialtyTabs = useMemo((): SpecialtyTab[] => {
    const specialtyMap = new Map<string, { id: string; name: string; professionalIds: Set<string> }>();

    professionals.forEach(prof => {
      prof.specialties.forEach(spec => {
        if (!specialtyMap.has(spec.id)) {
          specialtyMap.set(spec.id, { id: spec.id, name: spec.name, professionalIds: new Set() });
        }
        specialtyMap.get(spec.id)!.professionalIds.add(prof.id);
      });
    });

    return Array.from(specialtyMap.values())
      .map(s => ({ id: s.id, name: s.name, count: s.professionalIds.size }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [professionals]);

  // Auto-select first specialty when tabs load
  useEffect(() => {
    if (specialtyTabs.length > 0 && !activeSpecialty) {
      setActiveSpecialty(specialtyTabs[0].id);
    }
  }, [specialtyTabs, activeSpecialty]);

  // Filter professionals by active specialty
  const filteredProfessionals = useMemo(() => {
    if (!activeSpecialty) return [];
    return professionals.filter(p => p.specialties.some(s => s.id === activeSpecialty));
  }, [professionals, activeSpecialty]);

  const handleScheduleAppointment = (professionalId: string) => {
    navigate(`/dashboard/calendar?patient=${patientId}&professional=${professionalId}`);
  };

  const handleNewAppointment = () => {
    setMainTab("schedule");
  };

  const activeSpecialtyName = specialtyTabs.find(s => s.id === activeSpecialty)?.name;

  const renderAppointmentItem = (apt: Appointment) => {
    const status = statusConfig[apt.status] || { label: apt.status, variant: "outline" as const };
    const typeLabel = typeLabels[apt.type] || apt.type;

    return (
      <AccordionItem key={apt.id} value={apt.id} className="border rounded-lg px-4 mb-2">
        <AccordionTrigger className="hover:no-underline py-3">
          <div className="flex flex-col items-start gap-1 text-left w-full">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {format(parseISO(apt.appointment_date), "dd/MM/yyyy", { locale: ptBR })}
              <Clock className="h-4 w-4 text-muted-foreground ml-2" />
              {apt.start_time.slice(0, 5)}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={status.variant}>{status.label}</Badge>
              <span className="text-xs text-muted-foreground">{typeLabel}</span>
              {apt.professional && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {apt.professional.name}
                </span>
              )}
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-4">
          <div className="space-y-2 text-sm">
            {apt.procedure && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Procedimento:</span>
                <span>{apt.procedure.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Horário:</span>
              <span>{apt.start_time.slice(0, 5)} - {apt.end_time.slice(0, 5)}</span>
            </div>
            {apt.notes && (
              <div className="mt-2">
                <span className="font-medium">Observações:</span>
                <p className="text-muted-foreground mt-1">{apt.notes}</p>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 overflow-hidden">
      {/* Main Tabs: History vs Schedule */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "history" | "schedule")}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
            <span className="sm:hidden">Histórico</span>
            {appointments.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {appointments.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Agendamento</span>
            <span className="sm:hidden">Agendar</span>
          </TabsTrigger>
        </TabsList>

        {/* History Tab */}
        <TabsContent value="history" className="mt-0">
          {appointmentsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : appointments.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 text-center px-4">
                <Calendar className="h-10 w-10 sm:h-12 sm:w-12 mb-3 sm:mb-4 text-muted-foreground/40" />
                <p className="text-muted-foreground font-medium text-sm sm:text-base">
                  Nenhum agendamento encontrado
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground/70 mt-1">
                  Este sócio ainda não possui agendamentos
                </p>
                <Button onClick={handleNewAppointment} className="mt-4 gap-2" size="sm">
                  <Plus className="h-4 w-4" />
                  Fazer Primeiro Agendamento
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Upcoming Appointments */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Próximos Agendamentos ({upcomingAppointments.length})
                </h3>
                {upcomingAppointments.length > 0 ? (
                  <Accordion type="single" collapsible className="space-y-2">
                    {upcomingAppointments.map(renderAppointmentItem)}
                  </Accordion>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg border-dashed">
                    Nenhum agendamento futuro
                  </p>
                )}
              </div>

              {/* Past Appointments */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico ({pastAppointments.length})
                </h3>
                {pastAppointments.length > 0 ? (
                  <Accordion type="single" collapsible className="space-y-2">
                    {pastAppointments.map(renderAppointmentItem)}
                  </Accordion>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg border-dashed">
                    Nenhum histórico de agendamentos
                  </p>
                )}
              </div>

              {/* New appointment button */}
              <div className="flex justify-end pt-2 border-t">
                <Button onClick={handleNewAppointment} className="gap-2" size="sm">
                  <Plus className="h-4 w-4" />
                  Novo Agendamento
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="mt-0">
          {professionalsLoading ? (
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3 sm:-mx-4 sm:px-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-9 w-24 sm:w-28 rounded-lg flex-shrink-0" />
              ))}
            </div>
          ) : specialtyTabs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 text-center px-4">
                <Stethoscope className="h-10 w-10 sm:h-12 sm:w-12 mb-3 sm:mb-4 text-muted-foreground/40" />
                <p className="text-muted-foreground font-medium text-sm sm:text-base">
                  Nenhuma especialidade disponível
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground/70 mt-1">
                  Não há profissionais com especialidades cadastradas
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {/* Specialty Tabs */}
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-3 px-3 sm:-mx-4 sm:px-4 scrollbar-hide">
                {specialtyTabs.map((specialty) => {
                  const isActive = activeSpecialty === specialty.id;
                  
                  return (
                    <button
                      key={specialty.id}
                      onClick={() => setActiveSpecialty(specialty.id)}
                      className={cn(
                        "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border transition-all whitespace-nowrap",
                        "text-xs sm:text-sm font-medium flex-shrink-0",
                        isActive
                          ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                          : "bg-card text-muted-foreground border-border hover:bg-muted"
                      )}
                    >
                      <span>{specialty.name}</span>
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "h-4 sm:h-5 px-1 sm:px-1.5 text-[10px] sm:text-xs min-w-4 sm:min-w-5 justify-center",
                          isActive ? "bg-primary/20 text-primary" : ""
                        )}
                      >
                        {specialty.count}
                      </Badge>
                    </button>
                  );
                })}
              </div>

              {/* Professionals Grid */}
              <div className="min-h-[200px] sm:min-h-[300px]">
                {filteredProfessionals.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 text-center px-4">
                      <Stethoscope className="h-10 w-10 sm:h-12 sm:w-12 mb-3 sm:mb-4 text-muted-foreground/40" />
                      <p className="text-muted-foreground font-medium text-sm sm:text-base">
                        Nenhum profissional disponível
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground/70 mt-1">
                        Não há profissionais para {activeSpecialtyName}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
                    {filteredProfessionals.map((professional) => (
                      <Card 
                        key={professional.id} 
                        className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group active:scale-[0.98]"
                        onClick={() => handleScheduleAppointment(professional.id)}
                      >
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            {/* Avatar */}
                            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/10">
                              {professional.photo_url ? (
                                <img 
                                  src={professional.photo_url} 
                                  alt={professional.name}
                                  className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover"
                                />
                              ) : (
                                <User className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">
                                {professional.name}
                              </h4>
                              <p className="text-[11px] sm:text-xs text-muted-foreground truncate mt-0.5">
                                {professional.specialties.map(s => s.name).join(", ") || "Especialista"}
                              </p>
                            </div>

                            {/* Arrow */}
                            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/50 group-hover:text-primary transition-colors flex-shrink-0" />
                          </div>

                          {/* Action hint */}
                          <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t flex items-center justify-between">
                            <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span className="hidden xs:inline">Clique para </span>agendar
                            </span>
                            <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground/50" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
