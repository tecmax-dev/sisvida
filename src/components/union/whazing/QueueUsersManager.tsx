import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, UserPlus, Trash2, Loader2, Settings2 } from "lucide-react";
import { useWhazingQueues } from "@/hooks/useWhazingQueues";
import {
  useQueueUsers,
  useAvailableUsersForQueue,
  useAddUserToQueue,
  useRemoveUserFromQueue,
} from "@/hooks/useWhazingQueueUsers";
import { toast } from "sonner";

export default function QueueUsersManager() {
  const [open, setOpen] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const { data: queues } = useWhazingQueues();
  const { data: queueUsers, isLoading: loadingUsers } = useQueueUsers(selectedQueueId);
  const { data: availableUsers } = useAvailableUsersForQueue();
  const addUser = useAddUserToQueue();
  const removeUser = useRemoveUserFromQueue();

  const assignedUserIds = new Set((queueUsers || []).map((u) => u.user_id));
  const unassignedUsers = (availableUsers || []).filter(
    (u) => !assignedUserIds.has(u.user_id)
  );

  const handleAdd = async () => {
    if (!selectedQueueId || !selectedUserId) return;
    try {
      await addUser.mutateAsync({ queueId: selectedQueueId, userId: selectedUserId });
      toast.success("Usuário adicionado à fila");
      setSelectedUserId("");
    } catch {
      toast.error("Erro ao adicionar usuário");
    }
  };

  const handleRemove = async (assignmentId: string) => {
    if (!selectedQueueId) return;
    try {
      await removeUser.mutateAsync({ assignmentId, queueId: selectedQueueId });
      toast.success("Usuário removido da fila");
    } catch {
      toast.error("Erro ao remover usuário");
    }
  };

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    owner: "Proprietário",
    receptionist: "Recepcionista",
    professional: "Profissional",
    administrative: "Administrativo",
    entidade_sindical_admin: "Admin Sindical",
    moderator: "Moderador",
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <Settings2 className="h-4 w-4" />
        Gerenciar Filas
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários por Fila
            </DialogTitle>
          </DialogHeader>

          {/* Queue selector */}
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {(queues || []).map((q) => (
                <button
                  key={q.id}
                  onClick={() => setSelectedQueueId(q.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedQueueId === q.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: q.color }} />
                  {q.name}
                </button>
              ))}
            </div>

            {selectedQueueId && (
              <>
                {/* Add user */}
                <div className="flex gap-2">
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um usuário..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedUsers.map((u) => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          <span className="flex items-center gap-2">
                            {u.user_name}
                            <Badge variant="secondary" className="text-[10px]">
                              {roleLabels[u.role] || u.role}
                            </Badge>
                          </span>
                        </SelectItem>
                      ))}
                      {unassignedUsers.length === 0 && (
                        <SelectItem value="__empty" disabled>
                          Todos os usuários já estão nesta fila
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    onClick={handleAdd}
                    disabled={!selectedUserId || addUser.isPending}
                  >
                    {addUser.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Users list */}
                <ScrollArea className="max-h-[300px]">
                  {loadingUsers ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (queueUsers || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum usuário vinculado a esta fila
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {(queueUsers || []).map((qu) => (
                        <div
                          key={qu.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border bg-card"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{qu.user_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{qu.user_email}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleRemove(qu.id)}
                            disabled={removeUser.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </>
            )}

            {!selectedQueueId && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Selecione uma fila para gerenciar os usuários
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
