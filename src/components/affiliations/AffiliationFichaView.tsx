import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { generateFiliacaoPDFBlob } from "@/lib/filiacao-pdf-generator";

const fmtDate = (v?: string | null) => {
  if (!v) return "-";
  const m = String(v).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
};

export type FichaPdfData = { filiacao: any; dependents: any[]; sindicato: any } | null | undefined;

/** Gera o PDF oficial da ficha (mesmo modelo impresso pelo sindicato). */
export function useFichaPdfUrl(pdfData: FichaPdfData) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    setUrl(null); setError(null);
    if (!pdfData?.filiacao) return;
    generateFiliacaoPDFBlob(pdfData.filiacao, pdfData.dependents ?? [], pdfData.sindicato)
      .then((blob) => { revoke = URL.createObjectURL(blob); setUrl(revoke); })
      .catch((e) => setError(e?.message || "Falha ao gerar a ficha"));
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [pdfData]);
  return { url, error };
}

/** Ficha de filiação: PDF oficial; arquivo enviado manualmente; ou resumo (fallback). */
export function AffiliationFichaView({ snapshot, fileUrl, pdfUrl, pdfLoading }: {
  snapshot: Record<string, any>; fileUrl?: string | null; pdfUrl?: string | null; pdfLoading?: boolean;
}) {
  if (fileUrl) return <iframe title="Ficha de filiação" src={fileUrl} className="h-[70vh] w-full rounded-md border" />;
  if (pdfUrl) return <iframe title="Ficha de filiação" src={pdfUrl} className="h-[70vh] w-full rounded-md border" />;
  if (pdfLoading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  return (
    <div className="space-y-2 rounded-md border bg-card p-4 text-sm">
      <h3 className="text-center text-base font-semibold">FICHA DE FILIAÇÃO SINDICAL</h3>
      <p><b>Nome:</b> {snapshot?.nome}</p>
      <p><b>CPF:</b> {snapshot?.cpf}</p>
      <p><b>Empresa:</b> {snapshot?.empresa_razao_social} ({snapshot?.empresa_cnpj})</p>
      <p><b>Aprovação:</b> {fmtDate(snapshot?.aprovado_at)}</p>
    </div>
  );
}

/** Abre o PDF para impressão. */
export function printPdf(url: string) {
  const w = window.open(url, "_blank");
  if (w) w.addEventListener("load", () => { try { w.print(); } catch { /* ignore */ } });
}

export { fmtDate };
