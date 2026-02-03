import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Bell, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  Image as ImageIcon,
  Calendar,
  Eye,
  EyeOff
} from "lucide-react";
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
  useAllPopupNotices,
  useCreatePopupNotice,
  useUpdatePopupNotice,
  useDeletePopupNotice,
  PopupNotice,
  PopupNoticeInput,
} from "@/hooks/usePopupNotices";
import { PopupNoticeFormDialog } from "@/components/union/PopupNoticeFormDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PopupNoticesPage() {
  const { currentClinic } = useAuth();
  const clinicId = currentClinic?.id;

  const { data: notices, isLoading } = useAllPopupNotices(clinicId || null);
  const createNotice = useCreatePopupNotice();
  const updateNotice = useUpdatePopupNotice();
  const deleteNotice = useDeletePopupNotice();

  const [formOpen, setFormOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<PopupNotice | null>(null);
  const [deletingNotice, setDeletingNotice] = useState<PopupNotice | null>(null);

  const handleCreate = (data: PopupNoticeInput) => {
    createNotice.mutate(data, {
      onSuccess: () => {
        setFormOpen(false);
      },
    });
  };

  const handleUpdate = (data: PopupNoticeInput) => {
    if (!editingNotice) return;
    updateNotice.mutate(
      { id: editingNotice.id, clinicId: clinicId!, ...data },
      {
        onSuccess: () => {
          setEditingNotice(null);
          setFormOpen(false);
        },
      }
    );
  };

  const handleToggleActive = (notice: PopupNotice) => {
    updateNotice.mutate({
      id: notice.id,
      clinicId: clinicId!,
      is_active: !notice.is_active,
    });
  };

  const handleDelete = () => {
    if (!deletingNotice || !clinicId) return;
    deleteNotice.mutate(
      { id: deletingNotice.id, clinicId },
      {
        onSuccess: () => {
          setDeletingNotice(null);
        },
      }
    );
  };

  const openEditDialog = (notice: PopupNotice) => {
    setEditingNotice(notice);
    setFormOpen(true);
  };

  const getStatusBadge = (notice: PopupNotice) => {
    const now = new Date();
    const startsAt = notice.starts_at ? new Date(notice.starts_at) : null;
    const expiresAt = notice.expires_at ? new Date(notice.expires_at) : null;

    if (!notice.is_active) {
      return <Badge variant="secondary">Inativo</Badge>;
    }
    if (startsAt && startsAt > now) {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Agendado</Badge>;
    }
    if (expiresAt && expiresAt < now) {
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Expirado</Badge>;
    }
    return <Badge className="bg-emerald-500">Ativo</Badge>;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    // Formato brasileiro 24h
    return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  if (!clinicId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Selecione uma clínica para continuar</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Avisos Pop-up
          </h1>
          <p className="text-muted-foreground">
            Gerencie os avisos que aparecem ao abrir o app
          </p>
        </div>
        <Button onClick={() => { setEditingNotice(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Aviso
        </Button>
      </div>

      {/* Notices List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : notices && notices.length > 0 ? (
        <div className="grid gap-4">
          {notices.map((notice) => (
            <Card key={notice.id} className="overflow-hidden">
              <div className="flex">
                {/* Image Thumbnail */}
                {notice.image_url ? (
                  <div className="w-32 h-32 flex-shrink-0">
                    <img
                      src={notice.image_url}
                      alt={notice.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 flex-shrink-0 bg-muted flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg truncate">{notice.title}</h3>
                        {getStatusBadge(notice)}
                        {notice.priority > 0 && (
                          <Badge variant="outline" className="text-xs">
                            Prioridade {notice.priority}
                          </Badge>
                        )}
                      </div>
                      {notice.message && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {notice.message}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Início: {formatDate(notice.starts_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Expira: {formatDate(notice.expires_at)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 mr-2">
                        {notice.is_active ? (
                          <Eye className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Switch
                          checked={notice.is_active}
                          onCheckedChange={() => handleToggleActive(notice)}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openEditDialog(notice)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeletingNotice(notice)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">Nenhum aviso cadastrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie avisos pop-up para informar os usuários do app
            </p>
            <Button onClick={() => { setEditingNotice(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Aviso
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Form Dialog */}
      <PopupNoticeFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingNotice(null);
        }}
        onSubmit={editingNotice ? handleUpdate : handleCreate}
        isLoading={createNotice.isPending || updateNotice.isPending}
        clinicId={clinicId}
        editingNotice={editingNotice}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingNotice} onOpenChange={() => setDeletingNotice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aviso?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o aviso "{deletingNotice?.title}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteNotice.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
