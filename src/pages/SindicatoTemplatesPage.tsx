import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileCode, RefreshCw, Copy, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://czmnkrurkzuerrcjzbkp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bW5rcnVya3p1ZXJyY2p6YmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NDkyMzEsImV4cCI6MjA4NDIyNTIzMX0.fu3d_I0Y6cxOp0CJRee9R_QsxtckGFIFdMqys0Pey8I";

// Cliente isolado sem persistir sessão — página é 100% pública
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Tpl {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  content: string;
}

function statusColor(status: string) {
  const s = status?.toLowerCase();
  if (s === "approved") return "bg-green-500/15 text-green-700 border-green-300";
  if (s === "pending") return "bg-yellow-500/15 text-yellow-700 border-yellow-300";
  if (s === "rejected") return "bg-red-500/15 text-red-700 border-red-300";
  return "bg-muted text-muted-foreground";
}

export default function SindicatoTemplatesPage() {
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await sb
        .from("whatsapp_templates")
        .select("id,name,category,language,status,content")
        .order("name", { ascending: true });
      if (error) throw error;
      setTemplates((data || []) as Tpl[]);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const copy = async (t: Tpl) => {
    try {
      await navigator.clipboard.writeText(t.content);
      setCopiedId(t.id);
      toast.success("Texto copiado!");
      setTimeout(() => setCopiedId((c) => (c === t.id ? null : c)), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const filtered = templates.filter((t) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.content.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  });

  const total = templates.length;
  const approved = templates.filter((t) => t.status?.toLowerCase() === "approved").length;
  const pending = templates.filter((t) => t.status?.toLowerCase() === "pending").length;
  const rejected = templates.filter((t) => t.status?.toLowerCase() === "rejected").length;

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileCode className="h-7 w-7 text-primary" /> Templates WhatsApp — Sindicato
          </h1>
          <p className="text-muted-foreground text-sm">
            Modelos salvos no sistema — clique em <strong>Copiar</strong> para usar.
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, conteúdo ou categoria..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {error && (
        <Card className="border-destructive"><CardContent className="p-4 text-destructive text-sm">{error}</CardContent></Card>
      )}

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <CardTitle className="text-base font-mono">{t.name}</CardTitle>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge variant="outline">{t.category}</Badge>
                    <Badge variant="outline">{t.language}</Badge>
                    <Badge className={statusColor(t.status)} variant="outline">{t.status}</Badge>
                    <Button
                      size="sm"
                      variant={copiedId === t.id ? "default" : "outline"}
                      onClick={() => copy(t)}
                      className="gap-1 h-7"
                    >
                      {copiedId === t.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedId === t.id ? "Copiado" : "Copiar"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <pre className="text-xs whitespace-pre-wrap bg-muted/50 p-3 rounded border font-sans">{t.content}</pre>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && !error && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum template encontrado.</CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}