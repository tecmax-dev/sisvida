import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bell } from "lucide-react";
import { CallAppointmentDialog, CallAppointmentTarget } from "./CallAppointmentDialog";

interface AgendaCallsTabProps {
  clinicId: string;
}

interface AgendaAppointment {
  id: string;
  start_time: string;
  status: string;
  patient_id: string | null;
  professional_id: string | null;
  patient: { name: string } | null;
  professional: { name: string } | null;
}

const statusLabels: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  arrived: "Chegou",
  in_progress: "Em atendimento",
  completed: "Concluído",
};

export function AgendaCallsTab({ clinicId }: AgendaCallsTabProps) {
  const [professionalFilter, setProfessionalFilter] = useState<string>("all");
  const [target, setTarget] = useState<CallAppointmentTarget | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["agenda-calls", clinicId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, start_time, status, patient_id, professional_id, patient:patients(name), professional:professionals(name)")
        .eq("clinic_id", clinicId)
        .eq("appointment_date", today)
        .not("status", "in", "(cancelled,no_show,blocked)")
        .order("start_time");
      if (error) throw error;
      return (data || []) as unknown as AgendaAppointment[];
    },
    refetchInterval: 15000,
  });

  const professionals = useMemo(() => {
    const map = new Map<string, string>();
    appointments.forEach((a) => {
      if (a.professional_id && a.professional?.name) map.set(a.professional_id, a.professional.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [appointments]);

  const filtered = appointments.filter(
    (a) => professionalFilter === "all" || a.professional_id === professionalFilter,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Agenda do Dia</CardTitle>
          <CardDescription>
            Chame pacientes agendados diretamente para o painel de atendimento
          </CardDescription>
        </div>
        <Select value={professionalFilter} onValueChange={setProfessionalFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Profissional" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os profissionais</SelectItem>
            {professionals.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Carregando agenda...</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Nenhum agendamento para hoje
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horário</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((apt) => (
                  <TableRow key={apt.id}>
                    <TableCell className="font-mono">{apt.start_time?.slice(0, 5)}</TableCell>
                    <TableCell className="font-medium">{apt.patient?.name || "—"}</TableCell>
                    <TableCell>{apt.professional?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{statusLabels[apt.status] || apt.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() =>
                          setTarget({
                            id: apt.id,
                            patient_id: apt.patient_id,
                            professional_id: apt.professional_id,
                            patientName: apt.patient?.name || "Paciente",
                            startTime: apt.start_time,
                          })
                        }
                      >
                        <Bell className="h-4 w-4 mr-1" />
                        Chamar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <CallAppointmentDialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        clinicId={clinicId}
        appointment={target}
      />
    </Card>
  );
}
