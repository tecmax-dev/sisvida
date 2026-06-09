import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MetaTpl {
  id?: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components?: any[];
}

const ENDPOINT =
  "https://czmnkrurkzuerrcjzbkp.supabase.co/functions/v1/meta-register-templates?action=list";

function statusColor(status: string) {
  const s = status?.toUpperCase();
  if (s === "APPROVED") return "bg-green-500/15 text-green-700 border-green-300";
  if (s === "PENDING") return "bg-yellow-500/15 text-yellow-700 border-yellow-300";
  if (s === "REJECTED") return "bg-red-500/15 text-red-700 border-red-300";
  return "bg-muted text-muted-foreground";
}

function bodyOf(components: any[] = []) {
  const b = components.find((c) => (c?.type || "").toUpperCase() === "BODY");
  return b?.text || "";
}

function buttonsOf(components: any[] = []) {
  const b = components.find((c) => (c?.type || "").toUpperCase() === "BUTTONS");
  return Array.isArray(b?.buttons) ? b.buttons : [];
}

export default function SindicatoTemplatesPage() {
  const [templates, setTemplates] = useState<MetaTpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(ENDPOINT);
      const json = await res.json();
      const list: MetaTpl[] = json?.data || json?.templates || json || [];
      setTemplates(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const total = templates.length;
  const approved = templates.filter((t) => t.status?.toUpperCase() === "APPROVED").length;
  const pending = templates.filter((t) => t.status?.toUpperCase() === "PENDING").length;
  const rejected = templates.filter((t) => t.status?.toUpperCase() === "REJECTED").length;

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileCode className="h-7 w-7 text-primary" /> Templates WhatsApp — Sindicato
          </h1>
          <p className="text-muted-foreground text-sm">
            Modelos oficiais registrados na Meta Cloud API.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Recarregar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Aprovados</div><div className="text-2xl font-bold text-green-600">{approved}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-2xl font-bold text-yellow-600">{pending}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Rejeitados</div><div className="text-2xl font-bold text-red-600">{rejected}</div></CardContent></Card>
      </div>

      {error && (
        <Card className="border-destructive"><CardContent className="p-4 text-destructive text-sm">{error}</CardContent></Card>
      )}

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const body = bodyOf(t.components);
            const buttons = buttonsOf(t.components);
            return (
              <Card key={`${t.name}-${t.language}`}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <CardTitle className="text-base font-mono">{t.name}</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="outline">{t.category}</Badge>
                      <Badge variant="outline">{t.language}</Badge>
                      <Badge className={statusColor(t.status)} variant="outline">{t.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {body && (
                    <pre className="text-xs whitespace-pre-wrap bg-muted/50 p-3 rounded border">{body}</pre>
                  )}
                  {buttons.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {buttons.map((b: any, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {b.type}: {b.text}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {templates.length === 0 && !error && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum template encontrado.</CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}