import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  User,
  Building2,
  Loader2,
  AlertCircle,
  CalendarClock,
} from "lucide-react";

interface HomologacaoData {
  id: string;
  appointment_date: string;
  start_time: string;
  status: string;
  employee_name: string;
  company_name: string;
  professional_name: string | null;
  clinic_name: string | null;
  clinic_address: string | null;
  clinic_phone: string | null;
}

type ActionDone = "confirmed" | "cancelled" | "reschedule" | null;

export default function HomologacaoConfirmation() {
  const { token } = useParams<{ token: string }>();
  const [appointment, setAppointment] = useState<HomologacaoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionComplete, setActionComplete] = useState<ActionDone>(null);
  const [reason, setReason] = useState("");
  const [formMode, setFormMode] = useState<"cancel" | "reschedule" | null>(null);

  useEffect(() => {
    const fetchAppointment = async () => {
      if (!token) {
        setError("Link inválido");
        setLoading(false);
        return;
      }
      try {
        const { data, error: fetchError } = await supabase.rpc(
          "get_homologacao_by_confirmation_token" as any,
          { _token: token },
        );
        if (fetchError) throw fetchError;
        const row: any = Array.isArray(data) ? data[0] : data;
        if (!row) {
          setError("Agendamento não encontrado ou link expirado");
          return;
        }
        setAppointment({
          id: row.id,
          appointment_date: row.appointment_date,
          start_time: row.start_time,
          status: row.status,
          employee_name: row.employee_name,
          company_name: row.company_name,
          professional_name: row.professional_name,
          clinic_name: row.clinic_name,
          clinic_address: row.clinic_address,
          clinic_phone: row.clinic_phone,
        });
      } catch (err) {
        console.error("Error fetching homologacao:", err);
        setError("Erro ao carregar dados do agendamento");
      } finally {
        setLoading(false);
      }
    };
    fetchAppointment();
  }, [token]);

  const runAction = async (action: "confirm" | "cancel" | "reschedule") => {
    if (!appointment) return;
    setActionLoading(true);
    try {
      const { data: result, error: rpcError } = await supabase.rpc(
        "act_on_homologacao_by_token" as any,
        { _token: token, _action: action, _reason: reason || null },
      );
      if (rpcError) throw rpcError;
      if (result !== "OK") throw new Error(String(result));

      if (action === "confirm") {
        setActionComplete("confirmed");
        setAppointment({ ...appointment, status: "confirmed" });
      } else if (action === "cancel") {
        setActionComplete("cancelled");
        setAppointment({ ...appointment, status: "cancelled" });
      } else {
        setActionComplete("reschedule");
      }
      setFormMode(null);
    } catch (err) {
      console.error("Error acting on homologacao:", err);
      setError("Não foi possível concluir. Tente novamente.");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const formatPhone = (phone: string | null) => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return phone;
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

  const isClosed = ["cancelled", "completed"].includes(appointment.status);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">
            {actionComplete === "confirmed" && "Presença confirmada!"}
            {actionComplete === "cancelled" && "Agendamento cancelado"}
            {actionComplete === "reschedule" && "Solicitação registrada"}
            {!actionComplete && (isClosed ? "Agendamento encerrado" : "Confirmar atendimento")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 rounded-lg bg-muted/40 p-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-medium">{appointment.employee_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span>{appointment.company_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="capitalize">{formatDate(appointment.appointment_date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>{appointment.start_time?.substring(0, 5)}</span>
            </div>
            {appointment.professional_name && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span>{appointment.professional_name}</span>
              </div>
            )}
          </div>

          {actionComplete && (
            <div className="text-center text-sm text-muted-foreground">
              {actionComplete === "confirmed" && "Obrigado! Sua presença foi confirmada."}
              {actionComplete === "cancelled" && "Seu agendamento foi cancelado."}
              {actionComplete === "reschedule" &&
                "Recebemos seu pedido de reagendamento. Nossa equipe entrará em contato."}
            </div>
          )}

          {!actionComplete && !isClosed && formMode === null && (
            <div className="space-y-2">
              <Button className="w-full" disabled={actionLoading} onClick={() => runAction("confirm")}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmar presença
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setFormMode("reschedule")}>
                <CalendarClock className="h-4 w-4" />
                Solicitar reagendamento
              </Button>
              <Button variant="outline" className="w-full text-destructive" onClick={() => setFormMode("cancel")}>
                <XCircle className="h-4 w-4" />
                Cancelar agendamento
              </Button>
            </div>
          )}

          {!actionComplete && formMode !== null && (
            <div className="space-y-3">
              <Label htmlFor="reason">
                {formMode === "cancel" ? "Motivo do cancelamento (opcional)" : "Observação para o reagendamento (opcional)"}
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Escreva aqui..."
              />
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setFormMode(null)} disabled={actionLoading}>
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  variant={formMode === "cancel" ? "destructive" : "default"}
                  disabled={actionLoading}
                  onClick={() => runAction(formMode === "cancel" ? "cancel" : "reschedule")}
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {formMode === "cancel" ? "Confirmar cancelamento" : "Enviar solicitação"}
                </Button>
              </div>
            </div>
          )}

          {(appointment.clinic_address || appointment.clinic_phone) && (
            <div className="border-t pt-4 text-center text-xs text-muted-foreground">
              {appointment.clinic_name && <p className="font-medium text-foreground">{appointment.clinic_name}</p>}
              {appointment.clinic_address && <p>{appointment.clinic_address}</p>}
              {appointment.clinic_phone && <p>{formatPhone(appointment.clinic_phone)}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
