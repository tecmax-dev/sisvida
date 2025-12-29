import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/auth/RoleGuard";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Monitor, Smartphone, Users, Bell, Copy } from "lucide-react";
import { CallsPanel } from "@/components/queue/CallsPanel";

interface Queue {
  id: string;
  clinic_id: string;
  name: string;
  queue_type: 'general' | 'priority' | 'scheduled';
  display_mode: 'name' | 'ticket' | 'initials';
  ticket_prefix: string;
  current_ticket: number;
  is_active: boolean;
}

interface Panel {
  id: string;
  clinic_id: string;
  name: string;
  token: string;
  is_active: boolean;
}

interface Totem {
  id: string;
  clinic_id: string;
  name: string;
  location: string | null;
  queue_id: string | null;
  token: string;
  is_active: boolean;
}

const queueTypeLabels: Record<string, string> = {
  general: "Geral",
  priority: "Prioritária",
  scheduled: "Agendados",
};

const displayModeLabels: Record<string, string> = {
  name: "Nome Completo",
  ticket: "Senha",
  initials: "Iniciais",
};

function QueueManagementContent() {
  const { currentClinic } = useAuth();
  const queryClient = useQueryClient();
  const [queueDialogOpen, setQueueDialogOpen] = useState(false);
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null);

  const [queueForm, setQueueForm] = useState({
    name: "",
    queue_type: "general" as Queue['queue_type'],
    display_mode: "ticket" as Queue['display_mode'],
    ticket_prefix: "A",
    is_active: true,
  });

  // Fetch queues
  const { data: queues = [], isLoading: loadingQueues } = useQuery({
    queryKey: ["queues", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic) return [];
      const { data, error } = await supabase
        .from("queues")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .is("deleted_at", null)
        .order("name");

      if (error) throw error;
      return data as Queue[];
    },
    enabled: !!currentClinic,
  });

  // Fetch panels
  const { data: panels = [] } = useQuery({
    queryKey: ["panels", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic) return [];
      const { data, error } = await supabase
        .from("panels")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("name");

      if (error) throw error;
      return data as Panel[];
    },
    enabled: !!currentClinic,
  });

  // Fetch totems
  const { data: totems = [] } = useQuery({
    queryKey: ["totems", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic) return [];
      const { data, error } = await supabase
        .from("totems")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("name");

      if (error) throw error;
      return data as Totem[];
    },
    enabled: !!currentClinic,
  });

  // Queue mutations
  const createQueueMutation = useMutation({
    mutationFn: async (data: typeof queueForm) => {
      const { error } = await supabase.from("queues").insert({
        clinic_id: currentClinic!.id,
        ...data,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queues"] });
      toast.success("Fila criada com sucesso");
      handleCloseQueueDialog();
    },
    onError: () => toast.error("Erro ao criar fila"),
  });

  const updateQueueMutation = useMutation({
    mutationFn: async (data: typeof queueForm & { id: string }) => {
      const { id, ...rest } = data;
      const { error } = await supabase.from("queues").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queues"] });
      toast.success("Fila atualizada");
      handleCloseQueueDialog();
    },
    onError: () => toast.error("Erro ao atualizar fila"),
  });

  const deleteQueueMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("queues")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queues"] });
      toast.success("Fila removida");
    },
    onError: () => toast.error("Erro ao remover fila"),
  });

  // Panel mutations
  const createPanelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("panels").insert({
        clinic_id: currentClinic!.id,
        name: `Painel ${panels.length + 1}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panels"] });
      toast.success("Painel criado");
    },
    onError: () => toast.error("Erro ao criar painel"),
  });

  // Totem mutations
  const createTotemMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("totems").insert({
        clinic_id: currentClinic!.id,
        name: `Totem ${totems.length + 1}`,
        queue_id: queues[0]?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["totems"] });
      toast.success("Totem criado");
    },
    onError: () => toast.error("Erro ao criar totem"),
  });

  const handleCloseQueueDialog = () => {
    setQueueDialogOpen(false);
    setEditingQueue(null);
    setQueueForm({
      name: "",
      queue_type: "general",
      display_mode: "ticket",
      ticket_prefix: "A",
      is_active: true,
    });
  };

  const handleEditQueue = (queue: Queue) => {
    setEditingQueue(queue);
    setQueueForm({
      name: queue.name,
      queue_type: queue.queue_type,
      display_mode: queue.display_mode,
      ticket_prefix: queue.ticket_prefix || "A",
      is_active: queue.is_active,
    });
    setQueueDialogOpen(true);
  };

  const handleSubmitQueue = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingQueue) {
      updateQueueMutation.mutate({ ...queueForm, id: editingQueue.id });
    } else {
      createQueueMutation.mutate(queueForm);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copiado!");
  };

  if (!currentClinic) return null;

  const baseUrl = window.location.origin;

  return (
    <RoleGuard permission="view_queue">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel de Atendimento</h1>
          <p className="text-muted-foreground">
            Gerencie filas, painéis de chamada e totens de check-in
          </p>
        </div>

        <Tabs defaultValue="queues" className="space-y-4">
          <TabsList>
            <TabsTrigger value="queues" className="gap-2">
              <Users className="h-4 w-4" />
              Filas
            </TabsTrigger>
            <TabsTrigger value="panels" className="gap-2">
              <Monitor className="h-4 w-4" />
              Painéis
            </TabsTrigger>
            <TabsTrigger value="totems" className="gap-2">
              <Smartphone className="h-4 w-4" />
              Totens
            </TabsTrigger>
            <TabsTrigger value="calls" className="gap-2">
              <Bell className="h-4 w-4" />
              Chamadas
            </TabsTrigger>
          </TabsList>

          {/* Filas */}
          <TabsContent value="queues">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Filas de Atendimento</CardTitle>
                  <CardDescription>Configure as filas de espera da clínica</CardDescription>
                </div>
                <Button onClick={() => setQueueDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Fila
                </Button>
              </CardHeader>
              <CardContent>
                {loadingQueues ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : queues.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma fila configurada
                  </div>
                ) : (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Exibição</TableHead>
                          <TableHead>Prefixo</TableHead>
                          <TableHead>Senha Atual</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queues.map((queue) => (
                          <TableRow key={queue.id}>
                            <TableCell className="font-medium">{queue.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{queueTypeLabels[queue.queue_type]}</Badge>
                            </TableCell>
                            <TableCell>{displayModeLabels[queue.display_mode]}</TableCell>
                            <TableCell className="font-mono">{queue.ticket_prefix}</TableCell>
                            <TableCell className="font-mono font-bold">
                              {queue.ticket_prefix}{queue.current_ticket || 0}
                            </TableCell>
                            <TableCell>
                              <Badge variant={queue.is_active ? "default" : "secondary"}>
                                {queue.is_active ? "Ativa" : "Inativa"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => handleEditQueue(queue)}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteQueueMutation.mutate(queue.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Painéis */}
          <TabsContent value="panels">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Painéis de Chamada</CardTitle>
                  <CardDescription>Telas para exibição em TVs e monitores</CardDescription>
                </div>
                <Button onClick={() => createPanelMutation.mutate()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Painel
                </Button>
              </CardHeader>
              <CardContent>
                {panels.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum painel configurado
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {panels.map((panel) => (
                      <div key={panel.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{panel.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {baseUrl}/panel/{panel.token}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(`${baseUrl}/panel/${panel.token}`)}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copiar Link
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/panel/${panel.token}`, '_blank')}
                          >
                            <Monitor className="h-4 w-4 mr-1" />
                            Abrir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Totens */}
          <TabsContent value="totems">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Totens de Check-in</CardTitle>
                  <CardDescription>Dispositivos para check-in de pacientes</CardDescription>
                </div>
                <Button onClick={() => createTotemMutation.mutate()} disabled={queues.length === 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Totem
                </Button>
              </CardHeader>
              <CardContent>
                {totems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {queues.length === 0
                      ? "Crie uma fila primeiro para adicionar totens"
                      : "Nenhum totem configurado"}
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {totems.map((totem) => (
                      <div key={totem.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{totem.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {totem.location || "Sem localização definida"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(`${baseUrl}/totem/${totem.token}`)}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copiar Link
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/totem/${totem.token}`, '_blank')}
                          >
                            <Smartphone className="h-4 w-4 mr-1" />
                            Abrir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Chamadas */}
          <TabsContent value="calls">
            <CallsPanel clinicId={currentClinic.id} queues={queues} />
          </TabsContent>
        </Tabs>

        {/* Queue Dialog */}
        <Dialog open={queueDialogOpen} onOpenChange={setQueueDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingQueue ? "Editar Fila" : "Nova Fila"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitQueue} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Fila</Label>
                <Input
                  value={queueForm.name}
                  onChange={(e) => setQueueForm({ ...queueForm, name: e.target.value })}
                  placeholder="Ex: Atendimento Geral"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={queueForm.queue_type}
                    onValueChange={(value) => setQueueForm({ ...queueForm, queue_type: value as Queue['queue_type'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">Geral</SelectItem>
                      <SelectItem value="priority">Prioritária</SelectItem>
                      <SelectItem value="scheduled">Agendados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Modo de Exibição</Label>
                  <Select
                    value={queueForm.display_mode}
                    onValueChange={(value) => setQueueForm({ ...queueForm, display_mode: value as Queue['display_mode'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ticket">Senha</SelectItem>
                      <SelectItem value="name">Nome Completo</SelectItem>
                      <SelectItem value="initials">Iniciais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Prefixo da Senha</Label>
                <Input
                  value={queueForm.ticket_prefix}
                  onChange={(e) => setQueueForm({ ...queueForm, ticket_prefix: e.target.value.toUpperCase() })}
                  placeholder="A"
                  maxLength={2}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="queue_active"
                  checked={queueForm.is_active}
                  onCheckedChange={(checked) => setQueueForm({ ...queueForm, is_active: checked })}
                />
                <Label htmlFor="queue_active">Fila ativa</Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseQueueDialog}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingQueue ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}

export default function QueueManagementPage() {
  return <QueueManagementContent />;
}
