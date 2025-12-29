import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, Phone, CheckCircle, Clock, RefreshCw, UserPlus, Volume2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Queue {
  id: string;
  name: string;
  ticket_prefix: string;
  display_mode: string;
  current_ticket: number;
  is_active: boolean;
}

interface QueueCall {
  id: string;
  queue_id: string;
  patient_id: string | null;
  ticket_number: number;
  ticket_prefix: string | null;
  room_name: string | null;
  status: string;
  checked_in_at: string;
  called_at: string | null;
  patient?: {
    name: string;
  };
  queue?: {
    name: string;
    display_mode: string;
  };
}

interface CallsPanelProps {
  clinicId: string;
  queues: Queue[];
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  waiting: { label: "Aguardando", variant: "secondary" },
  called: { label: "Chamado", variant: "default" },
  in_service: { label: "Em Atendimento", variant: "outline" },
  completed: { label: "Concluído", variant: "secondary" },
  no_show: { label: "Não Compareceu", variant: "destructive" },
};

export function CallsPanel({ clinicId, queues }: CallsPanelProps) {
  const queryClient = useQueryClient();
  const [manualCallDialogOpen, setManualCallDialogOpen] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<string>("");
  const [roomName, setRoomName] = useState("");
  const [patientName, setPatientName] = useState("");

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // Fetch today's queue calls
  const { data: queueCalls = [], isLoading, refetch } = useQuery({
    queryKey: ["queue-calls", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("queue_calls")
        .select(`
          *,
          patient:patients(name),
          queue:queues(name, display_mode)
        `)
        .eq("clinic_id", clinicId)
        .gte("checked_in_at", todayISO)
        .order("checked_in_at", { ascending: false });

      if (error) throw error;
      return data as QueueCall[];
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Realtime subscription for queue_calls
  useEffect(() => {
    const channel = supabase
      .channel('queue-calls-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_calls',
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicId, refetch]);

  // Call next patient mutation
  const callNextMutation = useMutation({
    mutationFn: async ({ queueId, room }: { queueId: string; room: string }) => {
      // Find next waiting patient in this queue
      const { data: nextCall, error: fetchError } = await supabase
        .from("queue_calls")
        .select("*")
        .eq("queue_id", queueId)
        .eq("status", "waiting")
        .gte("checked_in_at", todayISO)
        .order("checked_in_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!nextCall) {
        throw new Error("Não há pacientes aguardando nesta fila");
      }

      // Update the call
      const { error: updateError } = await supabase
        .from("queue_calls")
        .update({
          status: "called",
          called_at: new Date().toISOString(),
          room_name: room || null,
        })
        .eq("id", nextCall.id);

      if (updateError) throw updateError;
      return nextCall;
    },
    onSuccess: (call) => {
      const queue = queues.find(q => q.id === call.queue_id);
      const ticket = `${call.ticket_prefix || queue?.ticket_prefix || ''}${call.ticket_number}`;
      toast.success(`Chamando senha ${ticket}`);
      queryClient.invalidateQueries({ queryKey: ["queue-calls"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Recall patient mutation
  const recallMutation = useMutation({
    mutationFn: async (callId: string) => {
      const { error } = await supabase
        .from("queue_calls")
        .update({
          called_at: new Date().toISOString(),
        })
        .eq("id", callId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paciente chamado novamente");
      queryClient.invalidateQueries({ queryKey: ["queue-calls"] });
    },
    onError: () => toast.error("Erro ao chamar paciente"),
  });

  // Start service mutation
  const startServiceMutation = useMutation({
    mutationFn: async (callId: string) => {
      const { error } = await supabase
        .from("queue_calls")
        .update({
          status: "in_service",
          attended_at: new Date().toISOString(),
        })
        .eq("id", callId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atendimento iniciado");
      queryClient.invalidateQueries({ queryKey: ["queue-calls"] });
    },
    onError: () => toast.error("Erro ao iniciar atendimento"),
  });

  // Complete service mutation
  const completeServiceMutation = useMutation({
    mutationFn: async (callId: string) => {
      const { error } = await supabase
        .from("queue_calls")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", callId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atendimento concluído");
      queryClient.invalidateQueries({ queryKey: ["queue-calls"] });
    },
    onError: () => toast.error("Erro ao concluir atendimento"),
  });

  // Mark as no-show mutation
  const noShowMutation = useMutation({
    mutationFn: async (callId: string) => {
      const { error } = await supabase
        .from("queue_calls")
        .update({
          status: "no_show",
          completed_at: new Date().toISOString(),
        })
        .eq("id", callId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcado como não compareceu");
      queryClient.invalidateQueries({ queryKey: ["queue-calls"] });
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  // Manual call (add patient to queue and call immediately)
  const manualCallMutation = useMutation({
    mutationFn: async ({ queueId, room, name }: { queueId: string; room: string; name: string }) => {
      const queue = queues.find(q => q.id === queueId);
      if (!queue) throw new Error("Fila não encontrada");

      const nextTicket = (queue.current_ticket || 0) + 1;

      // Update queue's current ticket
      const { error: queueError } = await supabase
        .from("queues")
        .update({ current_ticket: nextTicket })
        .eq("id", queueId);

      if (queueError) throw queueError;

      // Create and call the queue entry
      const { error: insertError } = await supabase
        .from("queue_calls")
        .insert({
          clinic_id: clinicId,
          queue_id: queueId,
          ticket_number: nextTicket,
          ticket_prefix: queue.ticket_prefix,
          room_name: room || null,
          status: "called",
          checked_in_at: new Date().toISOString(),
          called_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;
      return { ticket: `${queue.ticket_prefix}${nextTicket}` };
    },
    onSuccess: (data) => {
      toast.success(`Senha ${data.ticket} chamada`);
      queryClient.invalidateQueries({ queryKey: ["queue-calls"] });
      queryClient.invalidateQueries({ queryKey: ["queues"] });
      setManualCallDialogOpen(false);
      setSelectedQueueId("");
      setRoomName("");
      setPatientName("");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const waitingCalls = queueCalls.filter(c => c.status === "waiting");
  const calledCalls = queueCalls.filter(c => c.status === "called");
  const inServiceCalls = queueCalls.filter(c => c.status === "in_service");

  const getDisplayName = (call: QueueCall) => {
    const displayMode = call.queue?.display_mode || "ticket";
    const ticket = `${call.ticket_prefix || ''}${call.ticket_number}`;
    
    if (displayMode === "ticket") {
      return ticket;
    }
    
    const patientName = call.patient?.name || "Paciente";
    
    if (displayMode === "initials") {
      const initials = patientName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3);
      return `${ticket} - ${initials}`;
    }
    
    return `${ticket} - ${patientName}`;
  };

  const handleCallNext = (queueId: string) => {
    callNextMutation.mutate({ queueId, room: roomName });
  };

  const handleManualCall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueueId) {
      toast.error("Selecione uma fila");
      return;
    }
    manualCallMutation.mutate({ queueId: selectedQueueId, room: roomName, name: patientName });
  };

  if (queues.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Configure uma fila primeiro para fazer chamadas
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Chamar Próximo
          </CardTitle>
          <CardDescription>Clique em uma fila para chamar o próximo paciente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {queues.filter(q => q.is_active !== false).map((queue) => {
              const waitingInQueue = waitingCalls.filter(c => c.queue_id === queue.id).length;
              return (
                <Button
                  key={queue.id}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-start gap-2"
                  onClick={() => handleCallNext(queue.id)}
                  disabled={callNextMutation.isPending || waitingInQueue === 0}
                >
                  <div className="flex items-center gap-2 w-full justify-between">
                    <span className="font-semibold">{queue.name}</span>
                    <Badge variant={waitingInQueue > 0 ? "default" : "secondary"}>
                      {waitingInQueue} aguardando
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Próxima senha: {queue.ticket_prefix}{(queue.current_ticket || 0) + 1}
                  </span>
                </Button>
              );
            })}
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setManualCallDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Chamada Manual
            </Button>
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Calls */}
      {calledCalls.length > 0 && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Volume2 className="h-5 w-5" />
              Chamados Agora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {calledCalls.map((call) => (
                <div key={call.id} className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div>
                    <p className="font-bold text-lg">{getDisplayName(call)}</p>
                    <p className="text-sm text-muted-foreground">
                      {call.room_name && `${call.room_name} • `}
                      {call.queue?.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => recallMutation.mutate(call.id)}>
                      <Volume2 className="h-4 w-4 mr-1" />
                      Rechamar
                    </Button>
                    <Button size="sm" variant="default" onClick={() => startServiceMutation.mutate(call.id)}>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Atender
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => noShowMutation.mutate(call.id)}>
                      Não Compareceu
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* In Service */}
      {inServiceCalls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Em Atendimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {inServiceCalls.map((call) => (
                <div key={call.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-semibold">{getDisplayName(call)}</p>
                    <p className="text-sm text-muted-foreground">
                      {call.room_name && `${call.room_name} • `}
                      {call.queue?.name}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => completeServiceMutation.mutate(call.id)}>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Concluir
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Waiting List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Fila de Espera ({waitingCalls.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {waitingCalls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum paciente aguardando
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Senha</TableHead>
                  <TableHead>Fila</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waitingCalls.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell className="font-mono font-bold">
                      {getDisplayName(call)}
                    </TableCell>
                    <TableCell>{call.queue?.name}</TableCell>
                    <TableCell>
                      {format(new Date(call.checked_in_at), "HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => callNextMutation.mutate({ queueId: call.queue_id, room: "" })}
                      >
                        <Phone className="h-4 w-4 mr-1" />
                        Chamar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico do Dia</CardTitle>
          <CardDescription>Todas as chamadas realizadas hoje</CardDescription>
        </CardHeader>
        <CardContent>
          {queueCalls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma chamada realizada hoje
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Senha</TableHead>
                  <TableHead>Fila</TableHead>
                  <TableHead>Sala</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Chamado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queueCalls.slice(0, 20).map((call) => {
                  const status = statusLabels[call.status] || { label: call.status, variant: "outline" as const };
                  return (
                    <TableRow key={call.id}>
                      <TableCell className="font-mono font-bold">
                        {call.ticket_prefix}{call.ticket_number}
                      </TableCell>
                      <TableCell>{call.queue?.name}</TableCell>
                      <TableCell>{call.room_name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(call.checked_in_at), "HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {call.called_at 
                          ? format(new Date(call.called_at), "HH:mm", { locale: ptBR })
                          : "-"
                        }
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Manual Call Dialog */}
      <Dialog open={manualCallDialogOpen} onOpenChange={setManualCallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chamada Manual</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleManualCall} className="space-y-4">
            <div className="space-y-2">
              <Label>Fila</Label>
              <Select value={selectedQueueId} onValueChange={setSelectedQueueId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a fila" />
                </SelectTrigger>
                <SelectContent>
                  {queues.map((queue) => (
                    <SelectItem key={queue.id} value={queue.id}>
                      {queue.name} (Próxima: {queue.ticket_prefix}{(queue.current_ticket || 0) + 1})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sala / Local (opcional)</Label>
              <Input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Ex: Consultório 1, Sala de Exames"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setManualCallDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={manualCallMutation.isPending}>
                {manualCallMutation.isPending ? "Chamando..." : "Chamar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
