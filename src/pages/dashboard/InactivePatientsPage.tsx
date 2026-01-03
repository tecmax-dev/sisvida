import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, UserMinus, Search, MessageSquare, Clock, Users } from "lucide-react";
import { format, subMonths, parseISO, differenceInMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RoleGuard } from "@/components/auth/RoleGuard";

interface InactivePatient {
  id: string;
  name: string;
  phone: string;
  email: string;
  lastAppointment: string | null;
  monthsInactive: number;
  totalAppointments: number;
}

export default function InactivePatientsPage() {
  const { currentClinic } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inactiveMonths, setInactiveMonths] = useState("3");
  const [searchQuery, setSearchQuery] = useState("");
  const [patients, setPatients] = useState<InactivePatient[]>([]);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (currentClinic?.id) {
      loadData();
    }
  }, [currentClinic?.id, inactiveMonths]);

  const loadData = async () => {
    setLoading(true);
    try {
      const cutoffDate = subMonths(new Date(), parseInt(inactiveMonths));

      // Load all patients
      const { data: allPatients } = await supabase
        .from("patients")
        .select("id, name, phone, email")
        .eq("clinic_id", currentClinic?.id)
        .eq("is_active", true);

      if (!allPatients) {
        setPatients([]);
        return;
      }

      // Load last appointments for each patient
      const { data: appointments } = await supabase
        .from("appointments")
        .select("patient_id, appointment_date")
        .eq("clinic_id", currentClinic?.id)
        .in("status", ["completed", "scheduled", "confirmed"])
        .order("appointment_date", { ascending: false });

      // Group appointments by patient
      const patientLastAppointment = new Map<string, { date: string; count: number }>();
      (appointments || []).forEach((a) => {
        const existing = patientLastAppointment.get(a.patient_id);
        if (existing) {
          existing.count++;
          if (a.appointment_date > existing.date) {
            existing.date = a.appointment_date;
          }
        } else {
          patientLastAppointment.set(a.patient_id, { date: a.appointment_date, count: 1 });
        }
      });

      // Filter inactive patients
      const inactivePatients: InactivePatient[] = allPatients
        .map((patient) => {
          const data = patientLastAppointment.get(patient.id);
          const lastDate = data?.date || null;
          const monthsInactive = lastDate 
            ? differenceInMonths(new Date(), parseISO(lastDate))
            : 999;

          return {
            id: patient.id,
            name: patient.name,
            phone: patient.phone || "-",
            email: patient.email || "-",
            lastAppointment: lastDate,
            monthsInactive,
            totalAppointments: data?.count || 0,
          };
        })
        .filter((p) => p.monthsInactive >= parseInt(inactiveMonths))
        .sort((a, b) => b.monthsInactive - a.monthsInactive);

      setPatients(inactivePatients);
    } catch (error) {
      console.error("Error loading inactive patients:", error);
      toast.error("Erro ao carregar pacientes inativos");
    } finally {
      setLoading(false);
    }
  };

  const handleSendReactivation = async (patient: InactivePatient) => {
    if (!patient.phone || patient.phone === "-") {
      toast.error("Paciente não possui telefone cadastrado");
      return;
    }

    setSending(patient.id);
    try {
      const { data: clinic } = await supabase
        .from("clinics")
        .select("name")
        .eq("id", currentClinic?.id)
        .single();

      const message = `Olá ${patient.name.split(" ")[0]}! 😊

Sentimos sua falta na ${clinic?.name}!

Faz tempo desde sua última consulta e gostaríamos de saber como você está.

Que tal agendar uma nova visita? Estamos à disposição para cuidar de você!

Entre em contato conosco para marcar seu horário.

_${clinic?.name}_`;

      const response = await supabase.functions.invoke("send-whatsapp", {
        body: {
          clinic_id: currentClinic?.id,
          phone: patient.phone,
          message,
        },
      });

      if (response.error) {
        throw new Error("Erro ao enviar mensagem");
      }

      toast.success(`Mensagem enviada para ${patient.name}`);
    } catch (error) {
      console.error("Error sending reactivation message:", error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(null);
    }
  };

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.includes(searchQuery) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <RoleGuard permission="view_reports">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Associados Inativos</h1>
            <p className="text-muted-foreground">
              Associados sem atendimentos recentes para reengajamento
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserMinus className="h-4 w-4" />
                Total Inativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{patients.length}</div>
              <p className="text-xs text-muted-foreground">
                Sem agendamento há {inactiveMonths}+ meses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Média de Inatividade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {patients.length > 0
                  ? Math.round(patients.reduce((s, p) => s + p.monthsInactive, 0) / patients.length)
                  : 0}{" "}
                meses
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Com Telefone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {patients.filter((p) => p.phone && p.phone !== "-").length}
              </div>
              <p className="text-xs text-muted-foreground">Disponíveis para contato</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div>
                <CardTitle>Lista de Inativos</CardTitle>
                <CardDescription>
                  Associados sem atendimentos no período selecionado
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                <Select value={inactiveMonths} onValueChange={setInactiveMonths}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Há 1+ mês</SelectItem>
                    <SelectItem value="3">Há 3+ meses</SelectItem>
                    <SelectItem value="6">Há 6+ meses</SelectItem>
                    <SelectItem value="12">Há 12+ meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Associado</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Último Atendimento</TableHead>
                  <TableHead className="text-center">Inatividade</TableHead>
                  <TableHead className="text-center">Total Atend.</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="font-medium">{patient.name}</TableCell>
                    <TableCell>{patient.phone}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{patient.email}</TableCell>
                    <TableCell>
                      {patient.lastAppointment
                        ? format(parseISO(patient.lastAppointment), "dd/MM/yyyy", { locale: ptBR })
                        : "Nunca"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          patient.monthsInactive >= 12
                            ? "destructive"
                            : patient.monthsInactive >= 6
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {patient.monthsInactive >= 999 ? "Nunca" : `${patient.monthsInactive}m`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{patient.totalAppointments}</TableCell>
                    <TableCell>
                      {patient.phone && patient.phone !== "-" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSendReactivation(patient)}
                          disabled={sending === patient.id}
                        >
                          {sending === patient.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Reativar
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPatients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum associado inativo encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
