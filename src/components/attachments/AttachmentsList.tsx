import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  FileImage,
  File,
  Download,
  Eye,
  Trash2,
  MoreVertical,
  History,
  FolderInput
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertPopup } from "@/components/ui/alert-popup";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PopupBase, PopupHeader, PopupTitle, PopupFooter } from "@/components/ui/popup-base";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PatientAttachment, PatientFolder } from "@/hooks/usePatientAttachments";

interface AttachmentsListProps {
  attachments: PatientAttachment[];
  folders: PatientFolder[];
  loading: boolean;
  onView: (attachment: PatientAttachment) => void;
  onDownload: (attachment: PatientAttachment) => void;
  onDelete: (attachment: PatientAttachment) => Promise<boolean>;
  onMove: (attachmentId: string, folderId: string | null) => Promise<boolean>;
  onViewLogs: (attachment: PatientAttachment) => void;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) {
    return FileImage;
  }
  if (fileType === "application/pdf" || fileType.includes("document")) {
    return FileText;
  }
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsList({
  attachments,
  folders,
  loading,
  onView,
  onDownload,
  onDelete,
  onMove,
  onViewLogs
}: AttachmentsListProps) {
  const [deleteTarget, setDeleteTarget] = useState<PatientAttachment | null>(null);
  const [moveTarget, setMoveTarget] = useState<PatientAttachment | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>("root");

  const handleDelete = async () => {
    if (deleteTarget) {
      await onDelete(deleteTarget);
      setDeleteTarget(null);
    }
  };

  const handleMove = async () => {
    if (moveTarget) {
      await onMove(moveTarget.id, selectedFolder === "root" ? null : selectedFolder);
      setMoveTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Nenhum anexo</h3>
        <p className="text-sm text-muted-foreground">
          Faça upload de arquivos para este paciente
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {attachments.map(attachment => {
          const Icon = getFileIcon(attachment.file_type);
          const isImage = attachment.file_type.startsWith("image/");

          return (
            <Card
              key={attachment.id}
              className="p-4 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    isImage ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate" title={attachment.file_name}>
                    {attachment.file_name}
                  </h4>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <p>{formatFileSize(attachment.file_size)}</p>
                    <p>
                      {format(new Date(attachment.uploaded_at), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR
                      })}
                    </p>
                    {attachment.uploader_name && (
                      <p className="truncate">Por: {attachment.uploader_name}</p>
                    )}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(attachment)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Visualizar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDownload(attachment)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onViewLogs(attachment)}>
                      <History className="h-4 w-4 mr-2" />
                      Histórico de Acesso
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      setMoveTarget(attachment);
                      setSelectedFolder(attachment.folder_id || "root");
                    }}>
                      <FolderInput className="h-4 w-4 mr-2" />
                      Mover para Pasta
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteTarget(attachment)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          );
        })}
      </div>

      <AlertPopup
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir Anexo"
        description={`Tem certeza que deseja excluir "${deleteTarget?.file_name}"? Esta ação não pode ser desfeita.`}
        cancelText="Cancelar"
        confirmText="Excluir"
        confirmVariant="destructive"
        onConfirm={handleDelete}
      />

      <PopupBase open={!!moveTarget} onClose={() => setMoveTarget(null)} maxWidth="sm">
        <PopupHeader>
          <PopupTitle>Mover para Pasta</PopupTitle>
        </PopupHeader>
        <Select value={selectedFolder} onValueChange={setSelectedFolder}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a pasta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="root">Raiz (Sem pasta)</SelectItem>
            {folders.map(folder => (
              <SelectItem key={folder.id} value={folder.id}>
                {folder.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <PopupFooter>
          <Button variant="outline" onClick={() => setMoveTarget(null)}>
            Cancelar
          </Button>
          <Button onClick={handleMove}>Mover</Button>
        </PopupFooter>
      </PopupBase>
    </>
  );
}
