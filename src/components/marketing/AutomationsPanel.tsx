import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Plus, Search, MoreHorizontal, Edit, Trash2, Zap, MessageSquare, Mail, Smartphone, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AutomationDialog from "./AutomationDialog";

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config: Record<string, any>;
  message_template: string;
  channel: string;
  delay_hours: number | null;
  is_active: boolean;
  execution_count: number | null;
  last_executed_at: string | null;
  created_at: string;
}

const triggerLabels: Record<string, string> = {
  post_attendance: "Pós-atendimento",
  appointment_confirmed: "Confirmação de consulta",
  post_registration: "Pós-cadastro",
  inactivity: "Inatividade",
  return_reminder: "Lembrete de retorno",
};

const channelIcons: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="h-4 w-4 text-green-500" />,
  email: <Mail className="h-4 w-4 text-blue-500" />,
  sms: <Smartphone className="h-4 w-4 text-purple-500" />,
};

export default function AutomationsPanel() {
  const { currentClinic } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [automationToDelete, setAutomationToDelete] = useState<Automation | null>(null);

  const { data: automations, isLoading } = useQuery({
    queryKey: ["automation-flows", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];

      const { data, error } = await (supabase as any)
        .from("automation_flows")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Automation[];
    },
    enabled: !!currentClinic?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("automation_flows")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-flows"] });
      toast.success("Automação excluída com sucesso");
      setDeleteDialogOpen(false);
      setAutomationToDelete(null);
    },
    onError: () => {
      toast.error("Erro ao excluir automação");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("automation_flows")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-flows"] });
      toast.success("Status atualizado");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  const filteredAutomations = automations?.filter((automation) =>
    automation.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (automation: Automation) => {
    setSelectedAutomation(automation);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedAutomation(null);
    setDialogOpen(true);
  };

  const handleDelete = (automation: Automation) => {
    setAutomationToDelete(automation);
    setDeleteDialogOpen(true);
  };

  if (!currentClinic) return null;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Fluxos de Automação</CardTitle>
            <CardDescription>
              Configure mensagens automáticas baseadas em eventos
            </CardDescription>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Automação
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar automações..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando automações...
            </div>
          ) : !filteredAutomations?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma automação configurada</p>
              <p className="text-sm mt-1">
                Crie automações para enviar mensagens automáticas
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Ativo</TableHead>
                    <TableHead>Automação</TableHead>
                    <TableHead>Gatilho</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Delay</TableHead>
                    <TableHead className="text-right">Execuções</TableHead>
                    <TableHead>Última Execução</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAutomations.map((automation) => (
                    <TableRow key={automation.id}>
                      <TableCell>
                        <Switch
                          checked={automation.is_active}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({
                              id: automation.id,
                              is_active: checked,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{automation.name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {triggerLabels[automation.trigger_type] || automation.trigger_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {channelIcons[automation.channel]}
                          <span className="capitalize">{automation.channel}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {automation.delay_hours ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {automation.delay_hours}h
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Imediato</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {automation.execution_count || 0}
                      </TableCell>
                      <TableCell>
                        {automation.last_executed_at ? (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(automation.last_executed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(automation)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(automation)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AutomationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        automation={selectedAutomation}
        clinicId={currentClinic.id}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a automação "{automationToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => automationToDelete && deleteMutation.mutate(automationToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
