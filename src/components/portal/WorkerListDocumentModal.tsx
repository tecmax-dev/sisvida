import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface Props {
  validationId: string | null;
  portalType: "employer" | "accounting_office";
  portalId: string;
  onClose: () => void;
}

export function WorkerListDocumentModal({ validationId, portalType, portalId, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [mime, setMime] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!validationId) return;
    setUrl(null); setError(null); setName(""); setMime("");
    supabase.functions
      .invoke("validate-worker-list", {
        body: { action: "get_file_url", validation_id: validationId, portal_type: portalType, portal_id: portalId },
      })
      .then(({ data, error: e }) => {
        if (e || data?.error) setError(data?.error || "Não foi possível abrir o documento.");
        else { setUrl(data.url); setName(data.file_name || "Lista de trabalhadores"); setMime(data.mime_type || ""); }
      });
  }, [validationId, portalType, portalId]);

  return (
    <Dialog open={!!validationId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{name || "Lista de trabalhadores"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 rounded-md border bg-muted/30 flex items-center justify-center overflow-hidden">
          {error ? (
            <p className="text-sm text-destructive p-4">{error}</p>
          ) : !url ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : mime === "application/pdf" ? (
            <iframe src={url} title={name} className="w-full h-full" />
          ) : (
            <img src={url} alt={name} className="max-w-full max-h-full object-contain" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
