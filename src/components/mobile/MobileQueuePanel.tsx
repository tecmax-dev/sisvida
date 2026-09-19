import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
import { BellRing, MonitorSpeaker, Ticket, Clock } from "lucide-react";
import { format } from "date-fns";

interface PanelCallRow {
  id: string;
  patient_name: string | null;
  professional_name: string | null;
  professional_specialty: string | null;
  room_name: string | null;
  ticket: string | null;
  called_at: string | null;
  status: string;
  queue_name: string | null;
}

/**
 * Painel público de acompanhamento dentro do app: mostra a chamada atual
 * do painel de atendimento e as últimas chamadas do dia.
 */
export function MobileQueuePanel({ clinicId }: { clinicId?: string | null }) {
  const [calls, setCalls] = useState<PanelCallRow[]>([]);

  const effectiveClinicId = clinicId || SINDICATO_CLINIC_ID;

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data, error } = await supabase.rpc("get_clinic_queue_panel" as never, {
        p_clinic_id: effectiveClinicId,
      } as never);
      if (!active || error) return;
      setCalls((data || []) as unknown as PanelCallRow[]);
    };

    load();
    const interval = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [effectiveClinicId]);

  if (calls.length === 0) return null;

  const [current, ...recent] = calls;
  const isCalled = current.status === "called";

  return (
    <div className="mx-4 mt-4">
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/40">
          <MonitorSpeaker className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-semibold text-foreground">Painel de atendimento</p>
        </div>

        {/* Chamada atual */}
        <div
          className={`px-4 py-4 ${
            isCalled ? "bg-emerald-50 dark:bg-emerald-950/30" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                isCalled ? "bg-emerald-600 text-white animate-pulse" : "bg-muted text-muted-foreground"
              }`}
            >
              {isCalled ? <BellRing className="h-6 w-6" /> : <Ticket className="h-6 w-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                {isCalled ? "Chamando agora" : "Última chamada"}
              </p>
              {current.patient_name && (
                <p className="text-base font-semibold text-foreground leading-tight truncate">
                  {current.patient_name}
                </p>
              )}
              <p className="text-2xl font-bold text-foreground leading-tight">
                {current.ticket || "—"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {[current.room_name, current.professional_name].filter(Boolean).join(" • ") ||
                  current.queue_name ||
                  ""}
              </p>
            </div>
          </div>
        </div>

        {/* Últimas chamadas */}
        {recent.length > 0 && (
          <div className="border-t border-border">
            <p className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Últimas chamadas
            </p>
            <ul className="pb-2">
              {recent.map((c) => (
                <li key={c.id} className="px-4 py-2 flex items-center gap-3">
                  <span className="text-base font-bold text-foreground w-20 shrink-0">
                    {c.ticket || "—"}
                  </span>
                  <div className="flex-1 min-w-0">
                    {c.patient_name && (
                      <p className="text-sm text-foreground truncate">{c.patient_name}</p>
                    )}
                    <p className="text-xs text-muted-foreground truncate">
                      {[c.room_name, c.professional_name].filter(Boolean).join(" • ") || c.queue_name || ""}
                    </p>
                  </div>
                  {c.called_at && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      {format(new Date(c.called_at), "HH:mm")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default MobileQueuePanel;
