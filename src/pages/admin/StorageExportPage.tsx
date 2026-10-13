import { useEffect, useState } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/design-system";
import { Download, Loader2, Archive } from "lucide-react";
import { toast } from "sonner";

type F = { path: string; size: number; url: string };
const PART_LIMIT = 500 * 1024 * 1024;
const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;

function splitParts(files: F[]): F[][] {
  const parts: F[][] = [];
  let cur: F[] = [], size = 0;
  for (const f of files) {
    if (cur.length && size + f.size > PART_LIMIT) { parts.push(cur); cur = []; size = 0; }
    cur.push(f); size += f.size;
  }
  if (cur.length) parts.push(cur);
  return parts;
}

export default function StorageExportPage() {
  const [buckets, setBuckets] = useState<string[]>([]);
  const [bucket, setBucket] = useState<string | null>(null);
  const [parts, setParts] = useState<F[][]>([]);
  const [listing, setListing] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState<{ blob: Blob; name: string } | null>(null);

  useEffect(() => {
    supabase.functions.invoke("storage-export", { body: { action: "buckets" } }).then(({ data, error }) => {
      if (error || data?.error) toast.error(data?.error || "Sem acesso."); else setBuckets(data.buckets);
    });
  }, []);

  const pick = async (b: string) => {
    setBucket(b); setParts([]); setReady(null); setListing(true);
    const { data, error } = await supabase.functions.invoke("storage-export", { body: { action: "list", bucket: b } });
    setListing(false);
    if (error || data?.error) return toast.error(data?.error || "Falha ao listar.");
    setParts(splitParts(data.files));
  };

  const build = async (i: number) => {
    if (!bucket) return;
    setBusy(i); setProgress(0); setReady(null);
    const zip = new JSZip();
    const files = parts[i];
    let failed = 0;
    for (let k = 0; k < files.length; k++) {
      try {
        const r = await fetch(files[k].url);
        if (!r.ok) throw new Error();
        zip.file(`${bucket}/${files[k].path}`, await r.blob());
      } catch { failed++; }
      setProgress(Math.round(((k + 1) / files.length) * 100));
    }
    const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
    const suffix = parts.length > 1 ? `-parte${i + 1}` : "";
    setReady({ blob, name: `${bucket}${suffix}.zip` });
    setBusy(null);
    if (failed) toast.warning(`${failed} arquivo(s) não puderam ser baixados.`);
  };

  const save = () => {
    if (!ready) return;
    const url = URL.createObjectURL(ready.blob);
    const a = document.createElement("a");
    a.href = url; a.download = ready.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Exportar arquivos guardados" description="Baixe cada pasta em ZIP, mantendo as subpastas. Links válidos por 1 hora; cada exportação fica registrada na auditoria." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-3 space-y-1">
          {buckets.length === 0 && <p className="text-sm text-muted-foreground p-2">Carregando pastas…</p>}
          {buckets.map((b) => (
            <Button key={b} variant={b === bucket ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => pick(b)} disabled={busy !== null}>
              <Archive className="h-4 w-4 mr-2" />{b}
            </Button>
          ))}
        </Card>
        <Card className="p-4 lg:col-span-2 space-y-3">
          {!bucket && <p className="text-sm text-muted-foreground">Escolha uma pasta.</p>}
          {listing && <p className="text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Listando arquivos…</p>}
          {bucket && !listing && parts.length === 0 && <p className="text-sm text-muted-foreground">Pasta vazia.</p>}
          {parts.map((p, i) => (
            <div key={i} className="flex items-center justify-between border rounded-md p-3">
              <div className="text-sm">
                <div className="font-medium">{bucket}{parts.length > 1 ? ` — parte ${i + 1}` : ""}</div>
                <div className="text-muted-foreground">{p.length} arquivo(s) · {mb(p.reduce((s, f) => s + f.size, 0))}</div>
              </div>
              <Button size="sm" onClick={() => build(i)} disabled={busy !== null}>
                {busy === i ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Archive className="h-4 w-4 mr-2" />}Preparar ZIP
              </Button>
            </div>
          ))}
          {busy !== null && <Progress value={progress} />}
          {ready && (
            <Button onClick={save} className="w-full"><Download className="h-4 w-4 mr-2" />Baixar {ready.name} ({mb(ready.blob.size)})</Button>
          )}
        </Card>
      </div>
    </div>
  );
}
