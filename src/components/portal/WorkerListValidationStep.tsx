import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, CheckCircle2, XCircle, Building2, FileText } from "lucide-react";

export interface WorkerListValidationResult {
  valido: boolean;
  confianca: number;
  empresa_identificada: string | null;
  cnpj_identificado: string | null;
  tipo_contribuicao_identificado: string | null;
  competencia: string | null;
  quantidade_trabalhadores: number | null;
  inconsistencias: string[];
  motivo: string;
}

interface Props {
  contributionId: string;
  portalType: "employer" | "accounting_office";
  portalId: string;
  employerName: string;
  employerCnpj: string;
  validationId: string | null;
  onValidated: (validationId: string | null) => void;
}

const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const STEPS = ["Empresa", "Tipo de contribuição", "Lista de trabalhadores", "Validação IA", "Valor", "Finalização"];

const formatCnpj = (c: string) => {
  const d = (c || "").replace(/\D/g, "");
  return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : c;
};

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    r.readAsDataURL(file);
  });

export function WorkerListValidationStep({
  contributionId, portalType, portalId, employerName, employerCnpj, validationId, onValidated,
}: Props) {
  const [types, setTypes] = useState<{ id: string; name: string }[]>([]);
  const [typeId, setTypeId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<WorkerListValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Nova validação sempre que mudar a empresa/lançamento
  useEffect(() => {
    setTypeId(""); setFile(null); setResult(null); setError(null); onValidated(null);
    supabase.functions
      .invoke("validate-worker-list", {
        body: { action: "list_types", contribution_id: contributionId, portal_type: portalType, portal_id: portalId },
      })
      .then(({ data }) => {
        setTypes(data?.types || []);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contributionId, portalId]);

  const reset = () => { setResult(null); setError(null); onValidated(null); };

  const handleFile = (f: File | null) => {
    reset();
    if (!f) { setFile(null); return; }
    const ok = ["application/pdf", "image/jpeg", "image/png"].includes(f.type) || /\.(pdf|jpe?g|png)$/i.test(f.name);
    if (!ok) { setError("Formato inválido. Envie PDF, JPG, JPEG ou PNG."); setFile(null); return; }
    if (f.size > 10 * 1024 * 1024) { setError("Arquivo maior que 10 MB."); setFile(null); return; }
    setFile(f);
  };

  const validate = async () => {
    if (!typeId) { setError("Selecione o tipo de contribuição."); return; }
    if (!file) { setError("Envie a relação de trabalhadores."); return; }
    reset();
    setAnalyzing(true);
    try {
      const mime = file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : /\.png$/i.test(file.name) ? "image/png" : "image/jpeg");
      const { data, error: fnErr } = await supabase.functions.invoke("validate-worker-list", {
        body: {
          contribution_id: contributionId, contribution_type_id: typeId, portal_type: portalType, portal_id: portalId,
          file_base64: await toBase64(file), file_name: file.name, mime_type: mime,
        },
      });
      if (fnErr || data?.error) { setError(data?.error || "Não foi possível validar agora. Tente novamente."); return; }
      setResult(data.result);
      onValidated(data.result?.valido ? data.validation_id : null);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setAnalyzing(false);
    }
  };

  const currentStep = validationId ? 4 : result ? 3 : file ? 2 : typeId ? 1 : 0;

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-1 text-[11px]">
        {STEPS.map((s, i) => (
          <li key={s} className={`px-2 py-0.5 rounded-full border ${i <= currentStep ? "bg-primary/10 border-primary/40 text-primary font-medium" : "border-border text-muted-foreground"}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <div className="rounded-lg border bg-muted/40 p-3 flex items-start gap-2">
        <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
        <div className="text-sm">
          <div className="font-medium text-foreground">{employerName}</div>
          <div className="text-muted-foreground">CNPJ {formatCnpj(employerCnpj)}</div>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Tipo de contribuição *</Label>
        <Select value={typeId} onValueChange={(v) => { setTypeId(v); reset(); }} disabled={analyzing}>
          <SelectTrigger className="mt-2"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
          <SelectContent>
            {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium">Relação de trabalhadores com contribuição recolhida *</Label>
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
        <Button type="button" variant="outline" className="mt-2 w-full justify-start" onClick={() => inputRef.current?.click()} disabled={analyzing}>
          {file ? <FileText className="h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
          <span className="truncate">{file ? file.name : "Selecionar arquivo (PDF, JPG, JPEG ou PNG)"}</span>
        </Button>
      </div>

      {analyzing ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Analisando a relação de trabalhadores...
        </div>
      ) : !validationId && (
        <Button type="button" className="w-full" onClick={validate} disabled={!typeId || !file}>
          Enviar e validar lista
        </Button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && result.valido && validationId && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm space-y-1">
          <div className="flex items-center gap-2 font-medium text-primary">
            <CheckCircle2 className="h-4 w-4" /> Relação de trabalhadores validada com sucesso. O valor da contribuição foi liberado.
          </div>
          <div className="text-muted-foreground">
            {result.quantidade_trabalhadores ?? "?"} trabalhador(es){result.competencia ? ` • Competência ${result.competencia}` : ""}
          </div>
        </div>
      )}

      {result && !result.valido && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-2">
          <div className="flex items-start gap-2 font-medium text-destructive">
            <XCircle className="h-4 w-4 mt-0.5" />
            Não foi possível validar este documento como uma relação de trabalhadores desta empresa. Verifique o arquivo e envie novamente.
          </div>
          <div className="text-foreground"><strong>Motivo:</strong> {result.motivo}</div>
          {result.inconsistencias?.length > 1 && (
            <ul className="list-disc pl-5 text-muted-foreground">
              {result.inconsistencias.slice(0, 6).map((i) => <li key={i}>{i}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
