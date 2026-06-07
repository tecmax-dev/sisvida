import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Result = { kind: string; title: string; message: string };

export default function AppointmentSmsConfirm() {
  const { token } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const x = params.get("x") === "1" ? "1" : "0";
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!token) return;
    const url = `${SUPABASE_URL}/functions/v1/appointment-action?t=${encodeURIComponent(token)}&x=${x}`;
    fetch(url, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } })
      .then(async (r) => {
        try { return await r.json(); }
        catch { return { kind: "invalid", title: "Erro", message: "Resposta inválida do servidor." }; }
      })
      .then((data) => setResult(data))
      .catch(() => setResult({ kind: "invalid", title: "Erro de conexão", message: "Tente novamente em instantes." }))
      .finally(() => setLoading(false));
  }, [token, x]);

  const isOk = result?.kind === "confirmed";
  const isCancel = result?.kind === "cancelled";
  const Icon = isOk ? CheckCircle2 : isCancel ? XCircle : AlertTriangle;
  const color = isOk ? "text-emerald-600" : isCancel ? "text-red-600" : "text-amber-600";

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <div className="bg-card border rounded-2xl shadow-lg max-w-sm w-full p-8 text-center">
        {loading ? (
          <>
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Processando…</p>
          </>
        ) : result ? (
          <>
            <Icon className={`h-16 w-16 mx-auto ${color}`} />
            <h1 className="mt-4 text-xl font-semibold text-foreground">{result.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{result.message}</p>
            <p className="mt-6 text-xs text-muted-foreground">ProsindWeb</p>
          </>
        ) : null}
      </div>
    </div>
  );
}