import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertTriangle, CalendarDays, Clock } from "lucide-react";
import { parseDateOnlyToLocalNoon } from "@/lib/date";

interface Slot { date: string; time: string; end: string }
interface Info { firstName: string; professionalName: string; clinicName: string; slots: Slot[] }

const fmtDay = (d: string) =>
  parseDateOnlyToLocalNoon(d).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

/** Página aberta pelo botão do WhatsApp: todas as vagas livres para o associado da lista de espera escolher. */
export default function WaitingListPickPage() {
  const token = new URLSearchParams(window.location.search).get("t") || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<Slot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const readErr = async (err: any) => {
    try { return await err?.context?.json?.(); } catch { return null; }
  };

  useEffect(() => {
    document.title = "Escolher horário — ProsindWeb";
    (async () => {
      const { data, error } = await supabase.functions.invoke("waiting-list-pick", { body: { action: "load", token } });
      if (error) setError((await readErr(error))?.error || "Não foi possível abrir este link.");
      else setInfo(data as Info);
      setLoading(false);
    })();
  }, [token]);

  const byDay = useMemo(() => {
    const m = new Map<string, Slot[]>();
    (info?.slots || []).forEach((s) => m.set(s.date, [...(m.get(s.date) || []), s]));
    return [...m.entries()];
  }, [info]);

  const confirm = async () => {
    if (!selected) return;
    setSaving(true); setNotice(null);
    const { error } = await supabase.functions.invoke("waiting-list-pick", {
      body: { action: "book", token, date: selected.date, time: selected.time },
    });
    setSaving(false);
    if (error) {
      const p = await readErr(error);
      if (p?.taken) {
        setNotice(p.error);
        setSelected(null);
        if (p.slots) setInfo((i) => (i ? { ...i, slots: p.slots } : i));
        return;
      }
      setError(p?.error || "Não foi possível agendar.");
      return;
    }
    setDone(selected);
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-start justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl">Escolha seu horário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : error ? (
            <div className="text-center space-y-2 py-6">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
              <p>{error}</p>
            </div>
          ) : done ? (
            <div className="text-center space-y-3 py-6">
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
              <p className="text-lg font-semibold">Consulta agendada!</p>
              <p className="capitalize">{fmtDay(done.date)} às {done.time}</p>
              <p className="text-sm text-muted-foreground">com {info?.professionalName}. Você pode acompanhar no aplicativo.</p>
            </div>
          ) : info && info.slots.length === 0 ? (
            <p className="text-center py-6">As vagas já foram preenchidas. Você continua na lista de espera.</p>
          ) : info ? (
            <>
              <p>
                Olá, <strong>{info.firstName}</strong>! Estas são as vagas livres com{" "}
                <strong>{info.professionalName}</strong> nos próximos 15 dias. Toque no horário que preferir.
              </p>
              {notice && <p className="text-sm text-destructive">{notice}</p>}
              <div className="space-y-4">
                {byDay.map(([date, slots]) => (
                  <div key={date}>
                    <p className="flex items-center gap-2 font-medium capitalize mb-2">
                      <CalendarDays className="h-4 w-4 text-primary" /> {fmtDay(date)}
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {slots.map((s) => {
                        const active = selected?.date === s.date && selected?.time === s.time;
                        return (
                          <Button key={s.time} type="button" size="sm" variant={active ? "default" : "outline"} onClick={() => setSelected(s)}>
                            {s.time}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="sticky bottom-0 bg-card pt-3 border-t space-y-2">
                {selected && (
                  <p className="text-sm flex items-center gap-2 capitalize">
                    <Clock className="h-4 w-4" /> {fmtDay(selected.date)} às {selected.time}
                  </p>
                )}
                <Button className="w-full" disabled={!selected || saving} onClick={confirm}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar este horário"}
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
