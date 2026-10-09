import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Eye, FileSignature, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AffiliationFichaView, fmtDate, printPdf, useFichaPdfUrl } from "./AffiliationFichaView";

type Doc = {
  id: string; employer_id: string; employer_cnpj: string | null; worker_name: string; title: string;
  version: number; approved_at: string | null; made_available_at: string; opened_at: string | null;
  ack_status: "pending" | "confirmed"; ack_at: string | null; ack_by_name: string | null;
  classification_notice: boolean; employers?: { name: string } | null;
};

const DECLARATION =
  "Declaro que recebi e tomei conhecimento desta ficha de filiação. Esta confirmação não representa autorização automática de desconto nem alteração automática da folha.";

/** "Filiações Recebidas" para Portal da Empresa e Portal do Contador. */
export function PortalAffiliationsPanel({
  portalType, portalId, onPendingChange, mode = "full", onOpenList,
}: {
  mode?: "full" | "alert";
  onOpenList?: () => void;
  portalType: "employer" | "accounting_office";
  portalId: string;
  onPendingChange?: (pendingEmployerIds: string[]) => void;
}) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<any>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [ackOpen, setAckOpen] = useState<string[] | null>(null);
  const [ackName, setAckName] = useState("");
  const [ackChecked, setAckChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { url: pdfUrl } = useFichaPdfUrl(viewing?.pdf_data);
  const printUrl = viewing?.file_url || pdfUrl;

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke("affiliation-documents", {
      body: { action: "list", portal_type: portalType, portal_id: portalId },
    });
    const list: Doc[] = data?.documents ?? [];
    setDocs(list);
    onPendingChange?.([...new Set(list.filter((d) => d.ack_status === "pending").map((d) => d.employer_id))]);
    setLoading(false);
  }, [portalType, portalId, onPendingChange]);

  useEffect(() => { if (portalId) void load(); }, [portalId, load]);

  const pending = docs.filter((d) => d.ack_status === "pending");
  const pendingEmployers = useMemo(() => new Set(pending.map((d) => d.employer_id)).size, [pending]);

  async function openDoc(id: string) {
    const { data, error } = await supabase.functions.invoke("affiliation-documents", {
      body: { action: "open", portal_type: portalType, portal_id: portalId, document_id: id },
    });
    if (error || !data?.document) return toast.error("Não foi possível abrir a ficha.");
    setViewing(data.document);
    setDocs((p) => p.map((d) => (d.id === id && !d.opened_at ? { ...d, opened_at: new Date().toISOString() } : d)));
  }

  async function confirm() {
    if (!ackOpen?.length) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("affiliation-documents", {
      body: { action: "acknowledge", portal_type: portalType, portal_id: portalId, document_ids: ackOpen, name: ackName, declaration: ackChecked },
    });
    setSaving(false);
    if (error || !data?.success) return toast.error(data?.error || "Não foi possível confirmar a ciência.");
    toast.success(`${data.confirmed.length} ciência(s) confirmada(s).${data.skipped.length ? ` ${data.skipped.length} ignorada(s): abra a ficha antes.` : ""}`);
    setAckOpen(null); setSelected([]); setAckChecked(false); setViewing(null);
    void load();
  }

  if (loading && !docs.length) return null;
  if (!docs.length) return mode === "full" ? <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">Nenhuma ficha de filiação recebida.</p> : null;
  if (mode === "alert" && !pending.length) return null;

  const visible = showAll ? docs : pending.length ? pending : docs.slice(0, 5);

  return (
    <section className="mb-6 space-y-3">
      {pending.length > 0 && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950">
          <div className="flex items-start gap-3">
            <FileSignature className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <h2 className="font-bold uppercase">Nova filiação sindical recebida</h2>
              <p className="text-sm">O SECMI informa que um trabalhador vinculado à sua empresa teve sua filiação sindical aprovada. Uma nova ficha de filiação está disponível para consulta.</p>
              <p className="text-sm font-semibold">Atenção: verifique a necessidade de atualização da contribuição sindical na folha de pagamento.</p>
              {portalType === "accounting_office" && (
                <p className="text-sm font-semibold">{pendingEmployers} empresa(s) com novas filiações — {pending.length} ficha(s) aguardando ciência.</p>
              )}
              <p className="text-xs">Enquanto houver ficha pendente, a geração de boletos da empresa correspondente fica bloqueada. Consultas e documentos continuam liberados.</p>
              {mode === "alert" && onOpenList && (
                <Button size="sm" className="mt-2" onClick={onOpenList}>Ver fichas de filiação</Button>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === "full" && (<>
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Filiações Recebidas</h3>
          <div className="flex gap-2">
            {selected.length > 0 && (
              <Button size="sm" onClick={() => { setAckName(""); setAckChecked(false); setAckOpen(selected); }}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Confirmar ciência ({selected.length})
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Só pendentes" : "Ver histórico"}
            </Button>
          </div>
        </div>
        <ul className="divide-y">
          {visible.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              {d.ack_status === "pending" && (
                <Checkbox
                  aria-label="Selecionar ficha"
                  disabled={!d.opened_at}
                  checked={selected.includes(d.id)}
                  onCheckedChange={(c) => setSelected((p) => (c ? [...p, d.id] : p.filter((x) => x !== d.id)))}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{d.worker_name}</p>
                <p className="text-xs text-muted-foreground">
                  {portalType === "accounting_office" && `${d.employers?.name ?? ""} · `}
                  Aprovada em {fmtDate(d.approved_at)} · disponível desde {fmtDate(d.made_available_at)}
                </p>
                {d.classification_notice && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                    <AlertTriangle className="h-3 w-3" /> Trabalhador estava na Taxa Negocial: revise a classificação para Mensalidade Sindical (CCT, autorização e competência de início) e evite cobrança simultânea.
                  </p>
                )}
              </div>
              {d.ack_status === "confirmed" ? (
                <Badge variant="secondary">Ciência em {fmtDate(d.ack_at)} · {d.ack_by_name}</Badge>
              ) : (
                <Badge variant="outline">Pendente</Badge>
              )}
              <Button size="sm" variant="outline" onClick={() => openDoc(d.id)}><Eye className="mr-1 h-4 w-4" /> Visualizar ficha</Button>
              {d.ack_status === "pending" && (
                <Button size="sm" disabled={!d.opened_at} title={!d.opened_at ? "Abra a ficha antes" : undefined}
                  onClick={() => { setAckName(""); setAckChecked(false); setAckOpen([d.id]); }}>
                  Confirmar ciência
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>

      </>)}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{viewing?.title} — {viewing?.worker_name}</DialogTitle></DialogHeader>
          {viewing && <AffiliationFichaView snapshot={viewing.snapshot} fileUrl={viewing.file_url} pdfUrl={pdfUrl} pdfLoading={!!viewing.pdf_data && !pdfUrl} />}
          <DialogFooter>
            <Button variant="outline" disabled={!printUrl} onClick={() => printUrl && printPdf(printUrl)}>Imprimir</Button>
            {printUrl && <Button variant="outline" asChild><a href={printUrl} download={`ficha-filiacao-${viewing?.worker_name ?? ""}.pdf`}>Baixar PDF</a></Button>}
            {viewing?.ack_status === "pending" && (
              <Button onClick={() => { setAckName(""); setAckChecked(false); setAckOpen([viewing.id]); }}>Confirmar ciência</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!ackOpen} onOpenChange={(o) => !o && setAckOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirmar ciência ({ackOpen?.length ?? 0})</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="ack-name">Nome do responsável</Label>
              <Input id="ack-name" value={ackName} onChange={(e) => setAckName(e.target.value)} placeholder="Nome completo" />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={ackChecked} onCheckedChange={(c) => setAckChecked(c === true)} />
              <span>{DECLARATION}</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAckOpen(null)}>Cancelar</Button>
            <Button disabled={saving || !ackChecked || ackName.trim().length < 3} onClick={confirm}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
