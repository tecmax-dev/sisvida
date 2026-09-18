import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Bell } from "lucide-react";

export interface CallAppointmentTarget {
  id: string;
  patient_id: string | null;
  professional_id: string | null;
  patientName: string;
  startTime?: string | null;
}

interface CallAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string | null | undefined;
  appointment: CallAppointmentTarget | null;
}

const ROOM_STORAGE_KEY = "queue:last-room-name";

export function CallAppointmentDialog({
  open,
  onOpenChange,
  clinicId,
  appointment,
}: CallAppointmentDialogProps) {
  const queryClient = useQueryClient();
  const [queueId, setQueueId] = useState<string>("");
  const [roomName, setRoomName] = useState<string>("");

  const { data: queues = [], isLoading } = useQuery({
    queryKey: ["queues-active", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("queues")
        .select("id, name, ticket_prefix, current_ticket")
        .eq("clinic_id", clinicId!)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!clinicId && open,
  });

  useEffect(() => {
    if (!open) return;
    setRoomName(localStorage.getItem(ROOM_STORAGE_KEY) || "");
  }, [open]);

  useEffect(() => {
    if (open && queues.length > 0 && !queueId) setQueueId(queues[0].id);
  }, [open, queues, queueId]);

  const callMutation = useMutation({
    mutationFn: async () => {
      if (!clinicId || !appointment) throw new Error("Dados incompletos");
      const queue = queues.find((q) => q.id === queueId);
      if (!queue) throw new Error("Selecione uma fila");

      const nowIso = new Date().toISOString();

      // Se o paciente já tem uma chamada para este agendamento, apenas rechama
      const { data: existing } = await supabase
        .from("queue_calls")
        .select("id, ticket_number, ticket_prefix")
        .eq("appointment_id", appointment.id)
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("queue_calls")
          .update({
            status: "called",
            called_at: nowIso,
            queue_id: queue.id,
            room_name: roomName || null,
          })
          .eq("id", existing.id);
        if (error) throw error;
        return `${existing.ticket_prefix || queue.ticket_prefix || ""}${existing.ticket_number}`;
      }

      const nextTicket = (queue.current_ticket || 0) + 1;

      const { error: queueError } = await supabase
        .from("queues")
        .update({ current_ticket: nextTicket })
        .eq("id", queue.id);
      if (queueError) throw queueError;

      const { error: insertError } = await supabase.from("queue_calls").insert({
        clinic_id: clinicId,
        queue_id: queue.id,
        appointment_id: appointment.id,
        patient_id: appointment.patient_id,
        professional_id: appointment.professional_id,
        ticket_number: nextTicket,
        ticket_prefix: queue.ticket_prefix,
        room_name: roomName || null,
        status: "called",
        checked_in_at: nowIso,
        called_at: nowIso,
      });
      if (insertError) throw insertError;

      return `${queue.ticket_prefix || ""}${nextTicket}`;
    },
    onSuccess: (ticket) => {
      localStorage.setItem(ROOM_STORAGE_KEY, roomName);
      toast.success(`Chamando ${appointment?.patientName} (${ticket})`);
      queryClient.invalidateQueries({ queryKey: ["queue-calls"] });
      queryClient.invalidateQueries({ queryKey: ["queues"] });
      queryClient.invalidateQueries({ queryKey: ["queues-active"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message || "Erro ao chamar paciente"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chamar no painel</DialogTitle>
          <DialogDescription>
            {appointment?.patientName}
            {appointment?.startTime ? ` • ${appointment.startTime.slice(0, 5)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Fila / Painel</Label>
            <Select value={queueId} onValueChange={setQueueId} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione a fila"} />
              </SelectTrigger>
              <SelectContent>
                {queues.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isLoading && queues.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma fila ativa. Crie uma fila no Painel de Atendimento.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Sala / Consultório</Label>
            <Input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Ex.: Consultório 2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => callMutation.mutate()}
            disabled={!queueId || callMutation.isPending}
          >
            <Bell className="h-4 w-4 mr-2" />
            Chamar paciente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
