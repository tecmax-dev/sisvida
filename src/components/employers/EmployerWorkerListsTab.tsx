import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Row {
  id: string;
  file_path: string;
  file_name: string | null;
  status: string;
  competence_month: number | null;
  competence_year: number | null;
  quantidade: number | null;
  reason: string | null;
  portal_type: string;
  created_at: string;
  type_name: string | null;
}

export default function EmployerWorkerListsTab({ employerId }: { employerId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("contribution_worker_list_validations")
      .select("id, file_path, file_name, status, competence_month, competence_year, reason, portal_type, created_at, ai_result, contribution_type:contribution_types(name)")
      .eq("employer_id", employerId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Não foi possível carregar as listas.");
    setRows(
      (data || []).map((r: any) => ({
        ...r,
        quantidade: r.ai_result?.quantidade_trabalhadores ?? null,
        type_name: r.contribution_type?.name ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, [employerId]);

  const open = async (r: Row) => {
    setOpening(r.id);
    const { data, error } = await supabase.storage.from("worker-lists").createSignedUrl(r.file_path, 3600);
    setOpening(null);
    if (error || !data?.signedUrl) return toast.error("Não foi possível abrir o arquivo.");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Listas de trabalhadores com recolhimento</h2>
          <p className="text-sm text-muted-foreground">Relações enviadas pela empresa ou contabilidade nos portais, com o resultado da validação.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma lista enviada até o momento.</div>
      ) : (
        <div className="divide-y rounded-lg border">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0 text-sm">
                <div className="font-medium text-foreground truncate">{r.file_name || "Lista de trabalhadores"}</div>
                <div className="text-muted-foreground text-xs">
                  {r.type_name || "—"}
                  {r.competence_month ? ` • Competência ${String(r.competence_month).padStart(2, "0")}/${r.competence_year}` : ""}
                  {r.quantidade ? ` • ${r.quantidade} trabalhador(es)` : ""}
                  {` • ${r.portal_type === "accounting_office" ? "Portal do Contador" : "Portal da Empresa"}`}
                  {` • ${new Date(r.created_at).toLocaleString("pt-BR")}`}
                </div>
                {r.status !== "valid" && r.reason && <div className="text-xs text-destructive mt-0.5">{r.reason}</div>}
              </div>
              <Badge variant={r.status === "valid" ? "default" : "destructive"}>{r.status === "valid" ? "Validada" : "Reprovada"}</Badge>
              <Button size="sm" variant="outline" onClick={() => open(r)} disabled={opening === r.id}>
                {opening === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} Abrir
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
