import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Calendar, Clock, User, Stethoscope, MapPin, Phone } from "lucide-react";
import { parseDateOnlyToLocalNoon } from "@/lib/date";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Appointment = {
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  patient_name?: string | null;
  professional_name?: string | null;
  clinic_name?: string | null;
  clinic_address?: string | null;
  clinic_phone?: string | null;
} | null;
type Result = { kind: string; title: string; message: string; appointment?: Appointment };

function fmtDate(d?: string | null) {
  if (!d) return "";
  try {
    return parseDateOnlyToLocalNoon(d).toLocaleDateString("pt-BR", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });
  } catch { return d; }
}
function fmtTime(t?: string | null) { return t ? t.slice(0, 5) : ""; }

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
  const appt = result?.appointment;

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
            {appt && (
              <div className="mt-6 text-left bg-muted/40 rounded-lg p-4 space-y-2 text-sm">
                {appt.patient_name && (
                  <div className="flex items-start gap-2"><User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" /><span className="text-foreground">{appt.patient_name}</span></div>
                )}
                {appt.date && (
                  <div className="flex items-start gap-2"><Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" /><span className="text-foreground capitalize">{fmtDate(appt.date)}</span></div>
                )}
                {appt.start_time && (
                  <div className="flex items-start gap-2"><Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" /><span className="text-foreground">{fmtTime(appt.start_time)}{appt.end_time ? ` – ${fmtTime(appt.end_time)}` : ""}</span></div>
                )}
                {appt.professional_name && (
                  <div className="flex items-start gap-2"><Stethoscope className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" /><span className="text-foreground">{appt.professional_name}</span></div>
                )}
                {appt.clinic_name && (
                  <div className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" /><span className="text-foreground">{appt.clinic_name}{appt.clinic_address ? ` — ${appt.clinic_address}` : ""}</span></div>
                )}
                {appt.clinic_phone && (
                  <div className="flex items-start gap-2"><Phone className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" /><a href={`tel:${appt.clinic_phone}`} className="text-primary underline">{appt.clinic_phone}</a></div>
                )}
              </div>
            )}
            <p className="mt-6 text-xs text-muted-foreground">ProsindWeb</p>
          </>
        ) : null}
      </div>
    </div>
  );
}