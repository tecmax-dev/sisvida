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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  UserPlus,
  Trash2,
  Loader2,
  Settings2,
  Plus,
  Pencil,
  X,
} from "lucide-react";
import {
  useWhazingQueues,
  useCreateQueue,
  useUpdateQueue,
  useDeleteQueue,
} from "@/hooks/useWhazingQueues";
import {
  useQueueUsers,
  useAvailableUsersForQueue,
  useAddUserToQueue,
  useRemoveUserFromQueue,
} from "@/hooks/useWhazingQueueUsers";
import { toast } from "sonner";

const QUEUE_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
];

export default function QueueUsersManager() {
  const [open, setOpen] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingQueue, setEditingQueue] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(QUEUE_COLORS[0]);
  const [formDescription, setFormDescription] = useState("");

  const { data: queues } = useWhazingQueues();
  const { data: queueUsers, isLoading: loadingUsers } = useQueueUsers(selectedQueueId);
  const { data: availableUsers } = useAvailableUsersForQueue();
  const addUser = useAddUserToQueue();
  const removeUser = useRemoveUserFromQueue();
  const createQueue = useCreateQueue();
  const updateQueue = useUpdateQueue();
  const deleteQueue = useDeleteQueue();

  const assignedUserIds = new Set((queueUsers || []).map((u) => u.user_id));
  const unassignedUsers = (availableUsers || []).filter(
    (u) => !assignedUserIds.has(u.user_id)
  );

  const resetForm = () => {
    setFormName("");
    setFormColor(QUEUE_COLORS[0]);
    setFormDescription("");
    setShowCreateForm(false);
    setEditingQueue(null);
  };

  const handleCreateQueue = async () => {
    if (!formName.trim()) return;
    try {
      await createQueue.mutateAsync({ name: formName.trim(), color: formColor, description: formDescription.trim() || undefined });
      toast.success("Fila criada com sucesso");
      resetForm();
    } catch {
      toast.error("Erro ao criar fila");
    }
  };

  const handleUpdateQueue = async () => {
    if (!editingQueue || !formName.trim()) return;
    try {
      await updateQueue.mutateAsync({ id: editingQueue, name: formName.trim(), color: formColor, description: formDescription.trim() });
      toast.success("Fila atualizada");
      resetForm();
    } catch {
      toast.error("Erro ao atualizar fila");
    }
  };

  const handleDeleteQueue = async (id: string) => {
    try {
      await deleteQueue.mutateAsync(id);
      toast.success("Fila desativada");
      if (selectedQueueId === id) setSelectedQueueId(null);
    } catch {
      toast.error("Erro ao desativar fila");
    }
  };

  const startEdit = (q: { id: string; name: string; color: string; description: string | null }) => {
    setEditingQueue(q.id);
    setFormName(q.name);
    setFormColor(q.color);
    setFormDescription(q.description || "");
    setShowCreateForm(true);
  };

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
              Filas e Usuários
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Queue selector + create button */}
            <div className="flex gap-2 flex-wrap items-center">
              {(queues || []).map((q) => (
                <div key={q.id} className="flex items-center gap-0.5">
                  <button
                    onClick={() => { setSelectedQueueId(q.id); resetForm(); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-l-full text-sm font-medium border transition-colors ${
                      selectedQueueId === q.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: q.color }} />
                    {q.name}
                  </button>
                  <button
                    onClick={() => startEdit(q)}
                    className="p-1.5 border border-l-0 border-border hover:bg-muted rounded-r-full transition-colors"
                    title="Editar fila"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="gap-1 rounded-full"
                onClick={() => { resetForm(); setShowCreateForm(true); setSelectedQueueId(null); }}
              >
                <Plus className="h-3.5 w-3.5" />
                Nova Fila
              </Button>
            </div>

            {/* Create / Edit Queue Form */}
            {showCreateForm && (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{editingQueue ? "Editar Fila" : "Nova Fila"}</p>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetForm}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Financeiro, Suporte..."
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Cor</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {QUEUE_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setFormColor(c)}
                        className={`h-6 w-6 rounded-full border-2 transition-all ${
                          formColor === c ? "border-foreground scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Descrição (opcional)</Label>
                  <Textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Descrição da fila..."
                    className="text-sm min-h-[60px]"
                  />
                </div>
                <div className="flex gap-2">
                  {editingQueue ? (
                    <>
                      <Button size="sm" onClick={handleUpdateQueue} disabled={!formName.trim() || updateQueue.isPending}>
                        {updateQueue.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteQueue(editingQueue)} disabled={deleteQueue.isPending}>
                        Desativar
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={handleCreateQueue} disabled={!formName.trim() || createQueue.isPending}>
                      {createQueue.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Fila"}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Queue users management */}
            {selectedQueueId && !showCreateForm && (
              <>
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
                  <Button size="icon" onClick={handleAdd} disabled={!selectedUserId || addUser.isPending}>
                    {addUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  </Button>
                </div>

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
                        <div key={qu.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
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

            {!selectedQueueId && !showCreateForm && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Selecione uma fila para gerenciar os usuários ou crie uma nova
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
