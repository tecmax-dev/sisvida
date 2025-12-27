import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Edit, Trash2, Bell, Wrench, CreditCard, Sparkles, AlertTriangle, Info, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import NotificationDialog from "@/components/admin/NotificationDialog";

interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: "maintenance" | "billing" | "feature" | "alert" | "info";
  priority: "low" | "medium" | "high" | "urgent";
  target_type: "all_clinics" | "specific_clinics" | "specific_plans";
  target_ids: string[] | null;
  scheduled_at: string;
  expires_at: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const typeConfig = {
  maintenance: { label: "Manutenção", icon: Wrench, color: "bg-orange-500" },
  billing: { label: "Cobrança", icon: CreditCard, color: "bg-blue-500" },
  feature: { label: "Novidade", icon: Sparkles, color: "bg-purple-500" },
  alert: { label: "Alerta", icon: AlertTriangle, color: "bg-red-500" },
  info: { label: "Informação", icon: Info, color: "bg-green-500" },
};

const priorityConfig = {
  low: { label: "Baixa", color: "bg-gray-500" },
  medium: { label: "Média", color: "bg-yellow-500" },
  high: { label: "Alta", color: "bg-orange-500" },
  urgent: { label: "Urgente", color: "bg-red-500" },
};

const targetConfig = {
  all_clinics: "Todas as clínicas",
  specific_clinics: "Clínicas específicas",
  specific_plans: "Planos específicos",
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<SystemNotification | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["system-notifications", filterType, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("system_notifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (filterType !== "all") {
        query = query.eq("type", filterType);
      }

      if (filterStatus === "active") {
        query = query.eq("is_active", true);
      } else if (filterStatus === "inactive") {
        query = query.eq("is_active", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SystemNotification[];
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("system_notifications")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-notifications"] });
      toast({
        title: "Status atualizado",
        description: "A notificação foi atualizada com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a notificação.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("system_notifications")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-notifications"] });
      toast({
        title: "Notificação excluída",
        description: "A notificação foi excluída com sucesso.",
      });
      setDeleteDialogOpen(false);
      setNotificationToDelete(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a notificação.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (notification: SystemNotification) => {
    setEditingNotification(notification);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setNotificationToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingNotification(null);
  };

  const isExpired = (notification: SystemNotification) => {
    if (!notification.expires_at) return false;
    return new Date(notification.expires_at) < new Date();
  };

  const isScheduled = (notification: SystemNotification) => {
    if (!notification.scheduled_at) return false;
    return new Date(notification.scheduled_at) > new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notificações do Sistema</h1>
          <p className="text-muted-foreground">
            Gerencie notificações importantes para as clínicas
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Notificação
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Tipo</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="maintenance">Manutenção</SelectItem>
                  <SelectItem value="billing">Cobrança</SelectItem>
                  <SelectItem value="feature">Novidade</SelectItem>
                  <SelectItem value="alert">Alerta</SelectItem>
                  <SelectItem value="info">Informação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Histórico de Notificações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : notifications?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma notificação encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Agendada para</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications?.map((notification) => {
                  const TypeIcon = typeConfig[notification.type].icon;
                  const expired = isExpired(notification);
                  const scheduled = isScheduled(notification);

                  return (
                    <TableRow key={notification.id} className={expired ? "opacity-50" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded ${typeConfig[notification.type].color}`}>
                            <TypeIcon className="h-4 w-4 text-white" />
                          </div>
                          <span className="text-sm">{typeConfig[notification.type].label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{notification.title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {notification.message}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${priorityConfig[notification.priority].color} text-white`}>
                          {priorityConfig[notification.priority].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{targetConfig[notification.target_type]}</span>
                      </TableCell>
                      <TableCell>
                        {notification.scheduled_at ? (
                          <span className={scheduled ? "text-blue-600 font-medium" : ""}>
                            {format(new Date(notification.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {notification.expires_at ? (
                          <span className={expired ? "text-red-600" : ""}>
                            {format(new Date(notification.expires_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        ) : (
                          "Sem expiração"
                        )}
                      </TableCell>
                      <TableCell>
                        {expired ? (
                          <Badge variant="secondary">Expirada</Badge>
                        ) : scheduled ? (
                          <Badge variant="outline" className="border-blue-500 text-blue-600">
                            Agendada
                          </Badge>
                        ) : notification.is_active ? (
                          <Badge className="bg-green-500">Ativa</Badge>
                        ) : (
                          <Badge variant="secondary">Inativa</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleActiveMutation.mutate({
                              id: notification.id,
                              is_active: !notification.is_active,
                            })}
                            title={notification.is_active ? "Desativar" : "Ativar"}
                          >
                            {notification.is_active ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(notification)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(notification.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <NotificationDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        notification={editingNotification}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir notificação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A notificação será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => notificationToDelete && deleteMutation.mutate(notificationToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
