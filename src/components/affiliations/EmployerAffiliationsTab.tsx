import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, History, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AffiliationFichaView, fmtDate } from "./AffiliationFichaView";

const EVENT_LABELS: Record<string, string> = {
  approved: "Filiação aprovada", card_issued: "Carteirinha emitida", made_available: "Ficha disponibilizada à empresa",
  opened: "Ficha aberta", acknowledged: "Ciência confirmada", employer_link_failed: "Falha no vínculo da empresa",
  manual_upload: "Documento enviado manualmente",
};

/** Aba "Filiações e Documentos" no cadastro da empresa (/sindicato). */
export default function EmployerAffiliationsTab({ employerId, employerCnpj, clinicId }: { employerId: string; employerCnpj?: string | null; clinicId?: string }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<any>(null);
  const [events, setEvents] = useState<any[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [workerName, setWorkerName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("affiliation_company_documents").select("*")
      .eq("employer_id", employerId).order("made_available_at", { ascending: false });
    setDocs(data ?? []);
    setLoading(false);
  }, [employerId]);
  useEffect(() => { void load(); }, [load]);

  async function view(d: any) {
    let fileUrl: string | null = null;
    if (d.file_path) {
      const { data } = await supabase.storage.from("affiliation-documents").createSignedUrl(d.file_path, 3600);
      fileUrl = data?.signedUrl ?? null;
    }
    setViewing({ ...d, file_url: fileUrl });
  }

  async function history(d: any) {
    const { data } = await (supabase as any).from("affiliation_document_events").select("*")
      .or(`document_id.eq.${d.id}${d.associado_id ? `,associado_id.eq.${d.associado_id}` : ""}`).order("created_at");
    setEvents(data ?? []);
  }

  async function upload(file: File | undefined) {
    if (!file || !clinicId) return;
    if (workerName.trim().length < 3) return toast.error("Informe o nome do trabalhador.");
    if (file.size > 10 * 1024 * 1024) return toast.error("Arquivo acima de 10 MB.");
    setUploading(true);
    try {
      const path = `${clinicId}/${employerId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("affiliation-documents").upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("affiliation_company_documents").insert({
        clinic_id: clinicId, employer_id: employerId, employer_cnpj: employerCnpj ?? null,
        worker_name: workerName.trim(), source: "manual", title: "Ficha/documento de filiação", file_path: path, created_by: u.user?.id,
      });
      if (error) throw error;
      toast.success("Documento disponibilizado para a empresa.");
      setWorkerName("");
      void load();
    } catch (e: any) {
      toast.error(e.message || "Falha no envio");
    } finally {
      setUploading(false);
    }
  }

  const pending = docs.filter((d) => d.ack_status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Filiações e Documentos</h2>
          <p className="text-sm text-muted-foreground">{docs.length} documento(s) · {pending} aguardando ciência</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input className="h-9 w-56" placeholder="Nome do trabalhador (envio manual)" value={workerName} onChange={(e) => setWorkerName(e.target.value)} />
          <label className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-md border px-3 text-sm hover:bg-muted">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Enviar ficha antiga
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={uploading}
              onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : docs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma ficha de filiação para esta empresa.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr><th className="py-2">Trabalhador</th><th>Aprovação</th><th>Disponibilizada</th><th>Ciência</th><th></th></tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-b">
                  <td className="py-2">
                    <div className="font-medium">{d.worker_name}</div>
                    <div className="text-xs text-muted-foreground">{d.worker_cpf || ""} {d.source === "manual" ? "· envio manual" : ""}</div>
                  </td>
                  <td>{fmtDate(d.approved_at)}</td>
                  <td>{fmtDate(d.made_available_at)}</td>
                  <td>
                    {d.ack_status === "confirmed" ? (
                      <Badge variant="secondary">Confirmada {fmtDate(d.ack_at)} {d.ack_at ? new Date(d.ack_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""} · {d.ack_by_name} ({d.ack_portal_type === "accounting_office" ? "contador" : "empresa"})</Badge>
                    ) : <Badge variant="outline">Pendente</Badge>}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <Button size="sm" variant="ghost" onClick={() => view(d)}><Eye className="mr-1 h-4 w-4" />Ficha</Button>
                    <Button size="sm" variant="ghost" onClick={() => history(d)}><History className="mr-1 h-4 w-4" />Histórico</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{viewing?.title} — {viewing?.worker_name}</DialogTitle></DialogHeader>
          {viewing && <AffiliationFichaView snapshot={viewing.snapshot} fileUrl={viewing.file_url} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!events} onOpenChange={(o) => !o && setEvents(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Histórico</DialogTitle></DialogHeader>
          <ul className="space-y-2 text-sm">
            {(events ?? []).map((e) => (
              <li key={e.id} className="rounded border p-2">
                <div className="font-medium">{EVENT_LABELS[e.event] ?? e.event}</div>
                <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")} {e.actor ? `· ${e.actor}` : ""}</div>
              </li>
            ))}
            {events?.length === 0 && <li className="text-muted-foreground">Sem movimentações.</li>}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
