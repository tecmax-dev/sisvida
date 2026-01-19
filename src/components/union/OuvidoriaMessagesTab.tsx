import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useOuvidoriaMessages,
  useUpdateOuvidoriaMessage,
  useDeleteOuvidoriaMessage,
  MESSAGE_TYPE_LABELS,
  STATUS_LABELS,
  OuvidoriaMessage,
  OuvidoriaStatus,
} from "@/hooks/useOuvidoriaMessages";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  MessageCircle,
  Loader2,
  Eye,
  Trash2,
  User,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ThumbsUp,
  Lightbulb,
  MessageSquareWarning,
  Filter,
} from "lucide-react";

const typeIcons: Record<string, React.ReactNode> = {
  sugestao: <Lightbulb className="h-4 w-4" />,
  elogio: <ThumbsUp className="h-4 w-4" />,
  reclamacao: <MessageSquareWarning className="h-4 w-4" />,
  denuncia: <AlertTriangle className="h-4 w-4" />,
};

export function OuvidoriaMessagesTab() {
  const [statusFilter, setStatusFilter] = useState<OuvidoriaStatus | "all">("all");
  const [selectedMessage, setSelectedMessage] = useState<OuvidoriaMessage | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: messages, isLoading } = useOuvidoriaMessages(
    statusFilter === "all" ? undefined : statusFilter
  );
  const updateMessage = useUpdateOuvidoriaMessage();
  const deleteMessage = useDeleteOuvidoriaMessage();

  const handleOpenDetail = (message: OuvidoriaMessage) => {
    setSelectedMessage(message);
    setAdminNotes(message.admin_notes || "");
    setIsDetailOpen(true);
  };

  const handleUpdateStatus = async (newStatus: OuvidoriaStatus) => {
    if (!selectedMessage) return;
    await updateMessage.mutateAsync({
      id: selectedMessage.id,
      status: newStatus,
      admin_notes: adminNotes,
    });
    setIsDetailOpen(false);
  };

  const handleSaveNotes = async () => {
    if (!selectedMessage) return;
    await updateMessage.mutateAsync({
      id: selectedMessage.id,
      admin_notes: adminNotes,
    });
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await deleteMessage.mutateAsync(deletingId);
    setIsDeleteOpen(false);
    setDeletingId(null);
  };

  const pendingCount = messages?.filter(m => m.status === "pending").length || 0;
  const inProgressCount = messages?.filter(m => m.status === "in_progress").length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <Clock className="h-5 w-5 text-yellow-700 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <MessageCircle className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inProgressCount}</p>
                <p className="text-xs text-muted-foreground">Em Andamento</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-5 w-5 text-green-700 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {messages?.filter(m => m.status === "resolved").length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Resolvidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800/50">
                <XCircle className="h-5 w-5 text-gray-700 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {messages?.filter(m => m.status === "archived").length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Arquivados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as OuvidoriaStatus | "all")}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="in_progress">Em Andamento</SelectItem>
            <SelectItem value="resolved">Resolvidos</SelectItem>
            <SelectItem value="archived">Arquivados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Messages List */}
      {!messages?.length ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">Nenhuma mensagem encontrada</h3>
            <p className="text-sm text-muted-foreground">
              As mensagens enviadas pelos associados via app aparecerão aqui
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {messages.map((message) => (
            <Card key={message.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg flex-shrink-0 ${MESSAGE_TYPE_LABELS[message.message_type].color}`}>
                    {typeIcons[message.message_type]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={MESSAGE_TYPE_LABELS[message.message_type].color}>
                          {MESSAGE_TYPE_LABELS[message.message_type].label}
                        </Badge>
                        <Badge className={STATUS_LABELS[message.status].color}>
                          {STATUS_LABELS[message.status].label}
                        </Badge>
                        {message.is_anonymous && (
                          <Badge variant="outline">Anônimo</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {format(new Date(message.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>

                    {/* Sender info */}
                    {!message.is_anonymous && message.patient_name && (
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {message.patient_name}
                        </span>
                        {message.patient_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {message.patient_phone}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Message preview */}
                    <p className="text-sm line-clamp-2">{message.message}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDetail(message)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDeletingId(message.id);
                        setIsDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedMessage && typeIcons[selectedMessage.message_type]}
              Detalhes da Manifestação
            </DialogTitle>
            <DialogDescription>
              Visualize e gerencie esta mensagem da ouvidoria
            </DialogDescription>
          </DialogHeader>

          {selectedMessage && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={MESSAGE_TYPE_LABELS[selectedMessage.message_type].color}>
                    {MESSAGE_TYPE_LABELS[selectedMessage.message_type].label}
                  </Badge>
                  <Badge className={STATUS_LABELS[selectedMessage.status].color}>
                    {STATUS_LABELS[selectedMessage.status].label}
                  </Badge>
                  {selectedMessage.is_anonymous && (
                    <Badge variant="outline">Anônimo</Badge>
                  )}
                </div>

                {/* Sender Info */}
                {!selectedMessage.is_anonymous && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Informações do Remetente</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2 text-sm">
                      {selectedMessage.patient_name && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedMessage.patient_name}</span>
                        </div>
                      )}
                      {selectedMessage.patient_cpf && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>CPF: {selectedMessage.patient_cpf}</span>
                        </div>
                      )}
                      {selectedMessage.patient_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedMessage.patient_phone}</span>
                        </div>
                      )}
                      {selectedMessage.patient_email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedMessage.patient_email}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Message */}
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap border dark:border-border">
                    {selectedMessage.message}
                  </div>
                </div>

                {/* Date Info */}
                <div className="text-sm text-muted-foreground">
                  <p>
                    Enviado em: {format(new Date(selectedMessage.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                  {selectedMessage.responded_at && (
                    <p>
                      Respondido em: {format(new Date(selectedMessage.responded_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>

                {/* Admin Notes */}
                <div className="space-y-2">
                  <Label>Notas do Administrador</Label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Adicione notas internas sobre esta manifestação..."
                    rows={3}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={updateMessage.isPending}
                  >
                    Salvar Notas
                  </Button>
                </div>

                {/* Status Change */}
                <div className="space-y-2">
                  <Label>Alterar Status</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedMessage.status !== "in_progress" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateStatus("in_progress")}
                        disabled={updateMessage.isPending}
                      >
                        <MessageCircle className="h-4 w-4 mr-1" />
                        Em Andamento
                      </Button>
                    )}
                    {selectedMessage.status !== "resolved" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateStatus("resolved")}
                        disabled={updateMessage.isPending}
                        className="text-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Marcar como Resolvido
                      </Button>
                    )}
                    {selectedMessage.status !== "archived" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateStatus("archived")}
                        disabled={updateMessage.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Arquivar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Mensagem</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta mensagem? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
