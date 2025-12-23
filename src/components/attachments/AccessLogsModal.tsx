import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, Download, Trash2, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PatientAttachment, AttachmentAccessLog } from "@/hooks/usePatientAttachments";

interface AccessLogsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachment: PatientAttachment | null;
  onFetchLogs: (attachmentId: string) => Promise<AttachmentAccessLog[]>;
}

function getActionIcon(action: string) {
  switch (action) {
    case "view":
      return Eye;
    case "download":
      return Download;
    case "delete":
      return Trash2;
    default:
      return History;
  }
}

function getActionLabel(action: string) {
  switch (action) {
    case "view":
      return "Visualizou";
    case "download":
      return "Baixou";
    case "delete":
      return "Excluiu";
    default:
      return action;
  }
}

function getActionColor(action: string) {
  switch (action) {
    case "view":
      return "text-blue-600 bg-blue-100";
    case "download":
      return "text-green-600 bg-green-100";
    case "delete":
      return "text-red-600 bg-red-100";
    default:
      return "text-gray-600 bg-gray-100";
  }
}

export function AccessLogsModal({
  open,
  onOpenChange,
  attachment,
  onFetchLogs
}: AccessLogsModalProps) {
  const [logs, setLogs] = useState<AttachmentAccessLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && attachment) {
      setLoading(true);
      onFetchLogs(attachment.id)
        .then(setLogs)
        .finally(() => setLoading(false));
    }
  }, [open, attachment, onFetchLogs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Acesso
          </DialogTitle>
        </DialogHeader>

        {attachment && (
          <p className="text-sm text-muted-foreground truncate">
            {attachment.file_name}
          </p>
        )}

        <ScrollArea className="h-80">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Nenhum acesso registrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map(log => {
                const Icon = getActionIcon(log.action);
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                        getActionColor(log.action)
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {log.user_name || "Usuário"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getActionLabel(log.action)} em{" "}
                        {format(new Date(log.accessed_at), "dd/MM/yyyy 'às' HH:mm:ss", {
                          locale: ptBR
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
