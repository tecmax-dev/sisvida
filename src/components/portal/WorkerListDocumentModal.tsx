import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Users } from "lucide-react";

interface Props {
  validationId: string | null;
  portalType: "employer" | "accounting_office";
  portalId: string;
  onClose: () => void;
}

interface RosterWorker { nome: string; cpf_ou_identificador: string | null }

export function WorkerListDocumentModal({ validationId, portalType, portalId, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [mime, setMime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterWorker[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!validationId) return;
    setUrl(null); setError(null); setName(""); setMime(""); setRoster(null); setLoading(true);
    supabase.functions
      .invoke("validate-worker-list", {
        body: { action: "get_file_url", validation_id: validationId, portal_type: portalType, portal_id: portalId },
      })
      .then(({ data, error: e }) => {
        setLoading(false);
        if (e || data?.error) { setError(data?.error || "Não foi possível abrir o documento."); return; }
        if (data?.roster) { setRoster(data.workers || []); setName(data.file_name || "Lista de trabalhadores"); return; }
        setUrl(data.url); setName(data.file_name || "Lista de trabalhadores"); setMime(data.mime_type || "");
      });
  }, [validationId, portalType, portalId]);

  return (
    <Dialog open={!!validationId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{name || "Lista de trabalhadores"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 rounded-md border bg-muted/30 overflow-hidden">
          {error ? (
            <div className="h-full flex items-center justify-center"><p className="text-sm text-destructive p-4">{error}</p></div>
          ) : roster ? (
            <div className="h-full overflow-y-auto p-4">
              <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1.5">
                <Users className="h-4 w-4" /> Lista montada no sistema — {roster.length} trabalhador(es)
              </p>
              {roster.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum nome registrado nesta lista.</p>
              ) : (
                <ol className="divide-y">
                  {roster.map((w, i) => (
                    <li key={`${w.nome}-${i}`} className="py-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="text-foreground">{i + 1}. {w.nome}</span>
                      {w.cpf_ou_identificador && <span className="text-muted-foreground font-mono text-xs shrink-0">{w.cpf_ou_identificador}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : loading || !url ? (
            <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : mime === "application/pdf" || mime === "text/html" ? (
            <iframe src={url} title={name} className="w-full h-full" sandbox="allow-same-origin" />
          ) : (
            <div className="h-full flex items-center justify-center"><img src={url} alt={name} className="max-w-full max-h-full object-contain" /></div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
