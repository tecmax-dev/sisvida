import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isInternalCaller, requireStaff, authErrorResponse } from "../_shared/authGuard.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const BUILD = "APPT-REMINDER-DISPATCH-2026-09-11-A";
// Brasil não adota horário de verão: America/Sao_Paulo = UTC-3 fixo.
const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
const WINDOW_MINUTES = 15;

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: cors });

/** Data/hora local (America/Sao_Paulo) representada em campos UTC de um Date deslocado. */
function spNow(): Date {
  return new Date(Date.now() - SP_OFFSET_MS);
}

function spDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function spMinutes(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function timeToMinutes(t: string): number {
  const [h, m] = String(t).slice(0, 5).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let internal = isInternalCaller(req);

  // Chamada do agendador interno (pg_cron) autenticada por chave do cofre
  if (!internal) {
    const cronKey = req.headers.get("x-cron-key");
    if (cronKey) {
      const { data: valid } = await admin.rpc("verify_reminder_cron_key", { _key: cronKey });
      internal = valid === true;
    }
  }

  if (!internal) {
    try {
      await requireStaff(req);
    } catch (authErr) {
      const denied = authErrorResponse(authErr, cors);
      if (denied) return denied;
      throw authErr;
    }
  }

  const body = await req.json().catch(() => ({} as any));
  const dryRun = body?.dryRun === true;

  const now = spNow();

  const { data: clinics, error: clinicsErr } = await admin
    .from("clinics")
    .select("id, name, reminder_enabled, reminder_hours")
    .eq("reminder_enabled", true);

  if (clinicsErr) return json({ ok: false, error: clinicsErr.message, build: BUILD }, 500);

  const results: any[] = [];
  let sent = 0;
  let blocked = 0;
  let failed = 0;

  for (const clinic of clinics || []) {
    const hours = Number((clinic as any).reminder_hours) || 24;

    // Janela alvo em horário de Brasília: [agora + H, agora + H + 15min)
    const startTarget = new Date(now.getTime() + hours * 60 * 60 * 1000);
    const endTarget = new Date(startTarget.getTime() + WINDOW_MINUTES * 60 * 1000);

    const dates = Array.from(new Set([spDateStr(startTarget), spDateStr(endTarget)]));

    const { data: appts, error: apptErr } = await admin
      .from("appointments")
      .select("id, appointment_date, start_time, status, reminder_sent")
      .eq("clinic_id", (clinic as any).id)
      .in("appointment_date", dates)
      .not("status", "in", "(cancelled,completed,no_show)")
      .or("reminder_sent.is.null,reminder_sent.eq.false");

    if (apptErr) {
      results.push({ clinic: (clinic as any).id, error: apptErr.message });
      continue;
    }

    const due = (appts || []).filter((a: any) => {
      const mins = timeToMinutes(a.start_time);
      if (a.appointment_date === spDateStr(startTarget) && mins >= spMinutes(startTarget)) {
        // mesmo dia do início da janela
        if (spDateStr(startTarget) === spDateStr(endTarget)) return mins < spMinutes(endTarget);
        return true;
      }
      if (a.appointment_date === spDateStr(endTarget) && spDateStr(startTarget) !== spDateStr(endTarget)) {
        return mins < spMinutes(endTarget);
      }
      return false;
    });

    for (const appt of due) {
      if (dryRun) {
        results.push({ appointment_id: appt.id, dryRun: true });
        continue;
      }

      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-appointment-reminder`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentId: appt.id }),
        });
        const out = await res.json().catch(() => ({}));
        if (out?.ok) sent++;
        else if (out?.blocked) blocked++;
        else failed++;
        results.push({ appointment_id: appt.id, ok: out?.ok === true, reason: out?.reason ?? null });
      } catch (e) {
        failed++;
        results.push({ appointment_id: appt.id, ok: false, reason: String(e) });
      }

      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  await admin.from("whatsapp_compliance_logs").insert({
    intent: "APPOINTMENT_REMINDER_DISPATCH",
    decision: failed > 0 ? "PARTIAL" : "OK",
    metadata: {
      build: BUILD,
      sp_time: `${spDateStr(now)} ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`,
      sent,
      blocked,
      failed,
      dry_run: dryRun,
    },
  });

  return json({ ok: true, sent, blocked, failed, count: results.length, results, build: BUILD });
});
