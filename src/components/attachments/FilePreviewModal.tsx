import { useState, useEffect } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PopupBase, PopupHeader, PopupTitle } from "@/components/ui/popup-base";
import type { PatientAttachment } from "@/hooks/usePatientAttachments";

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachment: PatientAttachment | null;
  onGetUrl: (attachment: PatientAttachment) => Promise<string | null>;
  onDownload: (attachment: PatientAttachment) => void;
}

export function FilePreviewModal({
  open,
  onOpenChange,
  attachment,
  onGetUrl,
  onDownload
}: FilePreviewModalProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && attachment) {
      setLoading(true);
      setFileUrl(null);
      onGetUrl(attachment)
        .then(setFileUrl)
        .finally(() => setLoading(false));
    }
  }, [open, attachment, onGetUrl]);

  if (!attachment) return null;

  const isImage = attachment.file_type.startsWith("image/");
  const isPdf = attachment.file_type === "application/pdf";
  const canPreview = isImage || isPdf;

  return (
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="4xl" className="flex flex-col max-h-[90vh]">
      <PopupHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <PopupTitle className="truncate pr-4">{attachment.file_name}</PopupTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownload(attachment)}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </PopupHeader>

      <div className="flex-1 min-h-0 flex items-center justify-center bg-muted/50 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Carregando...</p>
          </div>
        ) : !canPreview ? (
          <div className="text-center p-8">
            <p className="text-muted-foreground mb-4">
              Visualização não disponível para este tipo de arquivo
            </p>
            <Button onClick={() => onDownload(attachment)}>
              <Download className="h-4 w-4 mr-2" />
              Baixar Arquivo
            </Button>
          </div>
        ) : fileUrl ? (
          isImage ? (
            <img
              src={fileUrl}
              alt={attachment.file_name}
              className="max-w-full max-h-full object-contain"
            />
          ) : isPdf ? (
            <iframe
              src={fileUrl}
              className="w-full h-full min-h-[500px]"
              title={attachment.file_name}
            />
          ) : null
        ) : (
          <p className="text-muted-foreground">Erro ao carregar arquivo</p>
        )}
      </div>
    </PopupBase>
  );
}
