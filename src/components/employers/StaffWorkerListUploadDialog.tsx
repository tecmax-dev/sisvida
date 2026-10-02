import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

interface Contribution {
  id: string;
  clinic_id: string;
  contribution_type_id: string | null;
  competence_month: number;
  competence_year: number;
  status: string;
  type_name: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  awaiting_value: "Aguardando valor",
  pending: "A vencer",
  overdue: "Vencida",
  paid: "Paga",
};

export function StaffWorkerListUploadDialog({
  employerId, open, onOpenChange, onUploaded,
}: { employerId: string; open: boolean; onOpenChange: (o: boolean) => void; onUploaded: () => void }) {
  const [contribs, setContribs] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [contribId, setContribId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setContribId(""); setFile(null);
    setLoading(true);
    (supabase as any)
      .from("employer_contributions")
      .select("id, clinic_id, contribution_type_id, competence_month, competence_year, status, contribution_type:contribution_types(name)")
      .eq("employer_id", employerId)
      .in("status", ["awaiting_value", "pending", "overdue", "paid"])
      .order("competence_year", { ascending: false })
      .order("competence_month", { ascending: false })
      .then(({ data, error }: any) => {
        if (error) toast.error("Não foi possível carregar as contribuições.");
        // Competências pagas: no máximo os últimos 6 meses
        const now = new Date();
        const minIdx = now.getFullYear() * 12 + now.getMonth() - 5; // inclui mês atual
        const rows = (data || []).filter((c: any) =>
          c.status !== "paid" || c.competence_year * 12 + (c.competence_month - 1) >= minIdx);
        setContribs(rows.map((c: any) => ({ ...c, type_name: c.contribution_type?.name ?? null })));
        setLoading(false);
      });
  }, [open, employerId]);

  const pickFile = (f: File | null) => {
    if (!f) return setFile(null);
    if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) { toast.error("Formato inválido. Envie PDF, JPG, JPEG ou PNG."); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error("Arquivo maior que 10 MB."); return; }
    setFile(f);
  };

  const save = async () => {
    const c = contribs.find((x) => x.id === contribId);
    if (!c || !file) return;
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sessão expirada. Entre novamente.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const path = `staff/${c.clinic_id}/${employerId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("worker-lists").upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { error: insErr } = await (supabase as any).from("contribution_worker_list_validations").insert({
        clinic_id: c.clinic_id,
        employer_id: employerId,
        contribution_id: c.id,
        contribution_type_id: c.contribution_type_id,
        competence_month: c.competence_month,
        competence_year: c.competence_year,
        portal_type: "staff",
        portal_id: uid,
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        status: "valid",
        reason: "Lista enviada pela equipe do sindicato.",
      });
      if (insErr) throw insErr;
      toast.success("Lista de trabalhadores enviada.");
      onUploaded();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível enviar a lista.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar lista de trabalhadores</DialogTitle>
          <DialogDescription>Escolha a contribuição (competência) e anexe a relação de funcionários.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="staff-wl-contrib">Contribuição *</Label>
            <select id="staff-wl-contrib" value={contribId} onChange={(e) => setContribId(e.target.value)} disabled={loading || saving}
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">{loading ? "Carregando..." : contribs.length ? "Selecione a competência" : "Nenhuma contribuição em aberto"}</option>
              {contribs.map((c) => (
                <option key={c.id} value={c.id}>
                  {String(c.competence_month).padStart(2, "0")}/{c.competence_year} — {c.type_name || "Contribuição"} ({STATUS_LABEL[c.status] || c.status})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Relação de trabalhadores *</Label>
            <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] || null)} />
            <Button type="button" variant="outline" className="mt-2 w-full justify-start" onClick={() => inputRef.current?.click()} disabled={saving}>
              {file ? <FileText className="h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              <span className="truncate">{file ? file.name : "Selecionar arquivo (PDF, JPG, JPEG ou PNG — até 10 MB)"}</span>
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={!contribId || !file || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />} Enviar lista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
