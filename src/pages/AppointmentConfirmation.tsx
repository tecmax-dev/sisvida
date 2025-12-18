import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Calendar, Clock, User, Building2, Loader2, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface AppointmentData {
  id: string;
  appointment_date: string;
  start_time: string;
  status: string;
  patient: {
    name: string;
  };
  professional: {
    name: string;
  };
  clinic: {
    name: string;
    address: string | null;
    phone: string | null;
  };
}

export default function AppointmentConfirmation() {
  const { token } = useParams<{ token: string }>();
  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionComplete, setActionComplete] = useState<"confirmed" | "cancelled" | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);

  useEffect(() => {
    const fetchAppointment = async () => {
      if (!token) {
        setError("Token inválido");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("appointments")
          .select(`
            id,
            appointment_date,
            start_time,
            status,
            patient:patients (name),
            professional:professionals (name),
            clinic:clinics (name, address, phone)
          `)
          .eq("confirmation_token", token)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!data) {
          setError("Consulta não encontrada ou link expirado");
          return;
        }

        setAppointment({
          id: data.id,
          appointment_date: data.appointment_date,
          start_time: data.start_time,
          status: data.status,
          patient: data.patient as any,
          professional: data.professional as any,
          clinic: data.clinic as any,
        });
      } catch (err: any) {
        console.error("Error fetching appointment:", err);
        setError("Erro ao carregar dados da consulta");
      } finally {
        setLoading(false);
      }
    };

    fetchAppointment();
  }, [token]);

  const handleConfirm = async () => {
    if (!appointment) return;

    setActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ 
          status: "confirmed",
          confirmed_at: new Date().toISOString()
        })
        .eq("confirmation_token", token);

      if (updateError) throw updateError;

      setActionComplete("confirmed");
      setAppointment({ ...appointment, status: "confirmed" });
    } catch (err: any) {
      console.error("Error confirming appointment:", err);
      setError("Erro ao confirmar consulta. Tente novamente.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!appointment) return;

    setActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ 
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: cancelReason || "Cancelado pelo paciente via link"
        })
        .eq("confirmation_token", token);

      if (updateError) throw updateError;

      setActionComplete("cancelled");
      setAppointment({ ...appointment, status: "cancelled" });
    } catch (err: any) {
      console.error("Error cancelling appointment:", err);
      setError("Erro ao cancelar consulta. Tente novamente.");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (timeStr: string) => {
    return timeStr.substring(0, 5);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Erro</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!appointment) return null;

  const isAlreadyProcessed = appointment.status === "confirmed" || appointment.status === "cancelled" || appointment.status === "completed";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4">
            <img src="/logo.png" alt="Logo" className="h-12 mx-auto" />
          </div>
          <CardTitle className="text-xl">
            {actionComplete === "confirmed" && "Consulta Confirmada!"}
            {actionComplete === "cancelled" && "Consulta Cancelada"}
            {!actionComplete && isAlreadyProcessed && `Consulta ${appointment.status === "confirmed" ? "Confirmada" : appointment.status === "cancelled" ? "Cancelada" : "Concluída"}`}
            {!actionComplete && !isAlreadyProcessed && "Confirmar Consulta"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Appointment Details */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Paciente</p>
                <p className="font-medium text-foreground">{appointment.patient?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Data</p>
                <p className="font-medium text-foreground capitalize">{formatDate(appointment.appointment_date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Horário</p>
                <p className="font-medium text-foreground">{formatTime(appointment.start_time)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Profissional</p>
                <p className="font-medium text-foreground">{appointment.professional?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Clínica</p>
                <p className="font-medium text-foreground">{appointment.clinic?.name}</p>
                {appointment.clinic?.address && (
                  <p className="text-sm text-muted-foreground">{appointment.clinic.address}</p>
                )}
              </div>
            </div>
          </div>

          {/* Success Messages */}
          {actionComplete === "confirmed" && (
            <div className="flex items-center gap-3 p-4 bg-success/10 rounded-lg border border-success/20">
              <CheckCircle2 className="h-6 w-6 text-success" />
              <div>
                <p className="font-medium text-success">Presença confirmada!</p>
                <p className="text-sm text-muted-foreground">Aguardamos você na data agendada.</p>
              </div>
            </div>
          )}

          {actionComplete === "cancelled" && (
            <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <XCircle className="h-6 w-6 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Consulta cancelada</p>
                <p className="text-sm text-muted-foreground">Caso precise reagendar, entre em contato com a clínica.</p>
              </div>
            </div>
          )}

          {/* Already processed status */}
          {!actionComplete && isAlreadyProcessed && (
            <div className={`flex items-center gap-3 p-4 rounded-lg border ${
              appointment.status === "confirmed" 
                ? "bg-success/10 border-success/20" 
                : "bg-muted border-border"
            }`}>
              {appointment.status === "confirmed" ? (
                <CheckCircle2 className="h-6 w-6 text-success" />
              ) : (
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                {appointment.status === "confirmed" && "Esta consulta já foi confirmada."}
                {appointment.status === "cancelled" && "Esta consulta foi cancelada."}
                {appointment.status === "completed" && "Esta consulta já foi realizada."}
              </p>
            </div>
          )}

          {/* Cancel form */}
          {showCancelForm && !actionComplete && !isAlreadyProcessed && (
            <div className="space-y-3">
              <Label htmlFor="cancelReason">Motivo do cancelamento (opcional)</Label>
              <Textarea
                id="cancelReason"
                placeholder="Informe o motivo do cancelamento..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
          )}

          {/* Action Buttons */}
          {!actionComplete && !isAlreadyProcessed && (
            <div className="flex flex-col gap-3">
              {!showCancelForm ? (
                <>
                  <Button 
                    onClick={handleConfirm} 
                    disabled={actionLoading}
                    className="w-full"
                    size="lg"
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Confirmar Presença
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCancelForm(true)}
                    disabled={actionLoading}
                    className="w-full"
                    size="lg"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar Consulta
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="destructive"
                    onClick={handleCancel} 
                    disabled={actionLoading}
                    className="w-full"
                    size="lg"
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Confirmar Cancelamento
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCancelForm(false)}
                    disabled={actionLoading}
                    className="w-full"
                    size="lg"
                  >
                    Voltar
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Contact info */}
          {appointment.clinic?.phone && (
            <p className="text-center text-sm text-muted-foreground">
              Dúvidas? Entre em contato: {appointment.clinic.phone}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
