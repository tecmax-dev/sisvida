import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BellRing, Ticket } from "lucide-react";

interface QueueCallRow {
  id: string;
  ticket_number: number | null;
  ticket_prefix: string | null;
  room_name: string | null;
  status: string;
  called_at: string | null;
  appointment_id: string | null;
  professional_name: string | null;
  queue_name: string | null;
  person_name: string | null;
}

/**
 * Mostra ao associado a senha gerada para o atendimento do dia e
 * avisa quando ele é chamado pelo painel.
 */
export function MobileQueueCallCard() {
  const [call, setCall] = useState<QueueCallRow | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data, error } = await supabase.rpc("get_my_queue_calls" as never);
      if (!active || error) return;
      const rows = (data || []) as unknown as QueueCallRow[];
      setCall(rows[0] || null);
    };

    load();
    const interval = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (!call) return null;

  const isCalled = call.status === "called";
  const ticket = `${call.ticket_prefix || ""}${String(call.ticket_number ?? "").padStart(3, "0")}`;

  return (
    <div className="mx-4 mt-4">
      <div
        className={`rounded-2xl p-4 border ${
          isCalled
            ? "bg-emerald-50 border-emerald-300 animate-pulse"
            : "bg-muted border-border"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`h-12 w-12 rounded-full flex items-center justify-center ${
              isCalled ? "bg-emerald-600 text-white" : "bg-background text-muted-foreground"
            }`}
          >
            {isCalled ? <BellRing className="h-6 w-6" /> : <Ticket className="h-6 w-6" />}
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">
              {isCalled ? "Você foi chamado!" : "Sua senha de atendimento"}
            </p>
            <p className="text-2xl font-bold text-foreground leading-tight">{ticket}</p>
            <p className="text-sm text-muted-foreground">
              {[call.room_name, call.professional_name].filter(Boolean).join(" • ") ||
                call.queue_name ||
                "Aguarde a chamada"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MobileQueueCallCard;
