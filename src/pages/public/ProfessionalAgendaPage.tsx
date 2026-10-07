import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CalendarDays } from "lucide-react";

type Item = { time: string; name: string; age?: number | null; status: string; procedure: string | null };
type Data = { professional: string; clinic: string; date: string; items: Item[] };

const STATUS: Record<string, string> = {
  scheduled: "Agendado", confirmed: "Confirmado", arrived: "Chegou",
  in_progress: "Em atendimento", completed: "Atendido", no_show: "Faltou",
};

export default function ProfessionalAgendaPage() {
  const { token } = useParams();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.functions.invoke("send-professional-agenda", { body: { action: "view", token } })
      .then(async ({ data, error }) => {
        if (error) {
          let msg = "Link inválido ou expirado.";
          try { msg = JSON.parse(await (error as any).context.text()).error || msg; } catch { /* noop */ }
          setError(msg);
        } else if (!data?.success) setError(data?.error || "Link inválido.");
        else setData(data);
      });
  }, [token]);

  if (error) return <div className="min-h-screen flex items-center justify-center p-6 text-center text-muted-foreground">{error}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const [y, m, d] = data.date.split("-");
  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="rounded-xl bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-primary"><CalendarDays className="h-5 w-5" /><span className="font-semibold">Agenda do dia {d}/{m}/{y}</span></div>
          <p className="mt-2 text-lg font-bold text-foreground">{data.professional}</p>
          <p className="text-sm text-muted-foreground">{data.clinic} · {data.items.length} atendimento(s)</p>
        </div>
        <div className="rounded-xl bg-card shadow-sm divide-y divide-border">
          {data.items.length === 0 && <p className="p-5 text-center text-muted-foreground">Nenhum atendimento marcado.</p>}
          {data.items.map((it, i) => (
            <div key={i} className="flex items-start gap-3 p-4">
              <span className="w-14 shrink-0 font-mono font-semibold text-primary">{it.time}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground break-words">{it.name}</p>
                {it.age != null && <p className="text-xs text-muted-foreground">{it.age} {it.age === 1 ? "ano" : "anos"}</p>}
                {it.procedure && <p className="text-xs text-muted-foreground">{it.procedure}</p>}
              </div>
              <span className="text-xs text-muted-foreground">{STATUS[it.status] ?? it.status}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">Link pessoal, válido até o fim do dia. Não compartilhe.</p>
      </div>
    </div>
  );
}
