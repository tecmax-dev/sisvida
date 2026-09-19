import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BellRing, Ticket } from "lucide-react";

// Toca um alerta sonoro curto (3 bipes) quando a senha é chamada
function playCallSound() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === "suspended") void ctx.resume();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.35 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.35 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.35);
      osc.stop(ctx.currentTime + i * 0.35 + 0.32);
    }
    setTimeout(() => void ctx.close(), 1500);
  } catch {
    // áudio indisponível (ex.: sem interação prévia) — ignora
  }
}

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
              {isCalled ? "Chamando agora" : "Senha de atendimento"}
            </p>
            {call.person_name && (
              <p className="text-base font-semibold text-foreground leading-tight">
                {call.person_name}
              </p>
            )}
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
