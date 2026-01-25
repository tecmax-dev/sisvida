import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Calendar, Clock, History, Loader2, Plus, User, XCircle } from "lucide-react";
import { format, isFuture, isPast, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { restoreSession } from "@/hooks/useMobileSession";

interface LegalAppointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  professional?: {
    id: string;
    name: string;
  } | null;
  service_type?: {
    id: string;
    name: string;
    duration_minutes: number;
  } | null;
}

export default function MobileLegalAppointmentsPage() {
  const [appointments, setAppointments] = useState<LegalAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"upcoming" | "history">("upcoming");
  const [selectedAppointment, setSelectedAppointment] = useState<LegalAppointment | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAppointments = async () => {
    try {
      const session = await restoreSession();
      const patientId = session.patientId;
      const clinicId = session.clinicId;

      if (!patientId || !clinicId) {
        console.log("[MobileLegalAppointments] No session found, redirecting to login");
        navigate("/app/login");
        return;
      }

      const { data: patient, error: patientError } = await supabase
        .from("patients")
        .select("cpf")
        .eq("id", patientId)
        .eq("clinic_id", clinicId)
        .maybeSingle();

      if (patientError || !patient?.cpf) {
        toast({
          title: "Erro",
          description: "Não foi possível identificar seu CPF para buscar os agendamentos jurídicos.",
          variant: "destructive",
        });
        navigate("/app/home");
        return;
      }

      // Normalize CPF: remove punctuation for comparison
      const normalizedCpf = patient.cpf.replace(/\D/g, "");
      const formattedCpf = normalizedCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

      // Search with both formats since DB may have inconsistent data
      const { data, error } = await (supabase
        .from("homologacao_appointments") as any)
        .select(
          `
          id, appointment_date, start_time, end_time, status, notes, cancellation_reason, cancelled_at,
          professional:homologacao_professionals(id, name),
          service_type:homologacao_service_types(id, name, duration_minutes)
        `
        )
        .eq("clinic_id", clinicId)
        .or(`employee_cpf.eq.${normalizedCpf},employee_cpf.eq.${formattedCpf}`)
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: false });


      if (error) throw error;

      setAppointments((data || []) as LegalAppointment[]);
    } catch (err: any) {
      console.error("Error loading legal appointments:", err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar seus agendamentos jurídicos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const upcomingAppointments = useMemo(() => {
    return appointments
      .filter((apt) => {
        const date = parseISO(apt.appointment_date);
        const isUpcoming = isFuture(date) || isToday(date);
        const isFinished = ["cancelled", "attended", "completed", "no_show"].includes(apt.status);
        return isUpcoming && !isFinished;
      })
      .sort((a, b) => parseISO(a.appointment_date).getTime() - parseISO(b.appointment_date).getTime());
  }, [appointments]);

  const historyAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const date = parseISO(apt.appointment_date);
      const isFinished = ["cancelled", "attended", "completed", "no_show"].includes(apt.status);
      return isPast(date) || isFinished;
    });
  }, [appointments]);

  const canCancel = (appointment: LegalAppointment) => {
    const date = parseISO(appointment.appointment_date);
    return isFuture(date) && ["scheduled", "confirmed"].includes(appointment.status);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      scheduled: { label: "Agendado", className: "bg-blue-100 text-blue-800" },
      confirmed: { label: "Confirmado", className: "bg-emerald-100 text-emerald-800" },
      attended: { label: "Atendido", className: "bg-gray-100 text-gray-800" },
      completed: { label: "Concluído", className: "bg-gray-100 text-gray-800" },
      cancelled: { label: "Cancelado", className: "bg-red-100 text-red-800" },
    };

    const config = statusConfig[status] || { label: status, className: "bg-gray-100 text-gray-800" };

    return <Badge className={`text-xs ${config.className}`}>{config.label}</Badge>;
  };

  const handleCancel = async () => {
    if (!selectedAppointment) return;

    setCancelling(true);
    try {
      const clinicId = localStorage.getItem("mobile_clinic_id");
      if (!clinicId) throw new Error("Sessão inválida");

      const { error } = await (supabase.from("homologacao_appointments") as any)
        .update({
          // RLS para app móvel permite apenas a transição de status para 'cancelled'
          // Campos como cancelled_at/updated_at são preenchidos por triggers no backend
          status: "cancelled",
        })
        .eq("id", selectedAppointment.id)
        .eq("clinic_id", clinicId);

      if (error) throw error;

      toast({
        title: "Agendamento cancelado",
        description: "Seu agendamento jurídico foi cancelado.",
      });

      setShowCancelDialog(false);
      setSelectedAppointment(null);
      await loadAppointments();
    } catch (err: any) {
      console.error("Error cancelling legal appointment:", err);
      toast({
        title: "Erro ao cancelar",
        description: err.message || "Não foi possível cancelar o agendamento.",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  const renderEmptyState = (type: "upcoming" | "history") => (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
        {type === "upcoming" ? (
          <Calendar className="h-12 w-12 text-gray-400" />
        ) : (
          <History className="h-12 w-12 text-gray-400" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {type === "upcoming" ? "Nenhum agendamento jurídico futuro" : "Nenhum histórico jurídico"}
      </h3>
      <p className="text-muted-foreground text-center text-sm">
        {type === "upcoming"
          ? "Você não possui agendamentos jurídicos futuros."
          : "Você ainda não possui histórico de atendimentos jurídicos."}
      </p>
      {type === "upcoming" && (
        <Button onClick={() => navigate("/app/agendar-juridico")} className="mt-4 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" />
          Novo agendamento jurídico
        </Button>
      )}
    </div>
  );

  const renderAppointmentCard = (appointment: LegalAppointment) => {
    const appointmentDate = parseISO(appointment.appointment_date);

    return (
      <Card
        key={appointment.id}
        className={`mb-3 border-l-4 ${canCancel(appointment) ? "border-l-emerald-500" : "border-l-gray-300"}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="font-medium text-foreground">
                {appointment.service_type?.name || "Atendimento jurídico"}
              </h3>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{format(appointmentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>
                    {appointment.start_time.slice(0, 5)} - {appointment.end_time.slice(0, 5)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{appointment.professional?.name || "Profissional"}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(appointment.status)}
              {canCancel(appointment) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    setSelectedAppointment(appointment);
                    setShowCancelDialog(true);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {/* Header */}
      <div className="bg-emerald-600 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/app/home")} className="p-1">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold flex-1">Agendamentos Jurídicos</h1>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full mt-4">
        <TabsList
          className="w-full rounded-none border-b h-12 bg-background p-0 mx-4"
          style={{ width: "calc(100% - 32px)" }}
        >
          <TabsTrigger
            value="upcoming"
            className="flex-1 h-full rounded-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Próximos
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="flex-1 h-full rounded-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600"
          >
            <History className="h-4 w-4 mr-2" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : upcomingAppointments.length > 0 ? (
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="p-4">{upcomingAppointments.map(renderAppointmentCard)}</div>
            </ScrollArea>
          ) : (
            renderEmptyState("upcoming")
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : historyAppointments.length > 0 ? (
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="p-4">{historyAppointments.map(renderAppointmentCard)}</div>
            </ScrollArea>
          ) : (
            renderEmptyState("history")
          )}
        </TabsContent>
      </Tabs>

      {/* Floating Action Button */}
      <Button
        onClick={() => navigate("/app/agendar-juridico")}
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-lg"
        size="icon"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Seu horário ficará disponível para outra pessoa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelling}>
              {cancelling ? "Cancelando..." : "Cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
