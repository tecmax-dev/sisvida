import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";
const APPOINTMENT_DATE = "2026-04-28";
const PROF_NAME_FILTER = "uiara";
const INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

const templates = [
  // RC1 — Política informativa. Sem CTA de resposta. Ação só no app oficial.
  (n: string, h: string) => `Olá, ${n}.\n\nLembramos que sua consulta está agendada para:\n\nData: 28/04/2026\nHorário: ${h}\nProfissional: Dra. Uiara Tiuba\n\nCaso seja necessário alterar ou cancelar seu agendamento, utilize exclusivamente o aplicativo oficial do Sindicato.\n\nSindicato dos Comerciários`,
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizePhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  if (full.length < 12 || full.length > 13) return null;
  return full;
}

function firstName(name: string): string {
  const f = (name || "").trim().split(/\s+/)[0] || "";
  return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
}

function getWhazingApiPlusUrl(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, "");
  if (cleanBase.endsWith("/apioficial")) return cleanBase;
  return `${cleanBase}/apioficial`;
}
function getWhazingSendUrl(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, "");
  if (cleanBase.includes("/api/external/") || cleanBase.endsWith("/apioficial")) return cleanBase;
  return `${cleanBase}/apioficial`;
}
function isChatgooExternalUrl(baseUrl: string): boolean {
  return baseUrl.includes("/api/external/");
}
function buildWhazingButtonPayload(_baseUrl: string, phone: string, bodyText: string, buttons: Array<{ id: string; title: string }>) {
  return {
    number: phone,
    contents: {
      type: "button",
      body: { text: bodyText },
      action: { buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })) },
    },
  };
}
function buildWhazingExternalButtonPayload(phone: string, bodyText: string, buttons: Array<{ id: string; title: string }>) {
  return { number: phone, body: bodyText, buttons: buttons.map((b) => ({ id: b.id, title: b.title })) };
}

async function sendConfirmationButtons(phone: string, appointmentId: string): Promise<boolean> {
  const whazingUrl = Deno.env.get("WHAZING_API_URL");
  const whazingToken = Deno.env.get("WHAZING_API_TOKEN");
  if (!whazingUrl || !whazingToken) {
    console.log("[uiara-28][buttons] Whazing not configured, skipping buttons");
    return false;
  }
  try {
    let cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;
    const buttons = [
      { id: `confirm_apt_${appointmentId}`, title: "Confirmar" },
      { id: `cancel_apt_${appointmentId}`, title: "Cancelar" },
    ];
    const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${whazingToken}` };
    const apiPlusUrl = getWhazingApiPlusUrl(whazingUrl);
    let response = await fetch(apiPlusUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(buildWhazingButtonPayload(whazingUrl, cleanPhone, "Confirme ou cancele sua consulta:", buttons)),
    });
    let responseText = await response.text();
    if (!response.ok && isChatgooExternalUrl(whazingUrl)) {
      console.warn(`[uiara-28][buttons] API PLUS failed (${response.status}); retrying external endpoint`);
      response = await fetch(getWhazingSendUrl(whazingUrl), {
        method: "POST",
        headers,
        body: JSON.stringify(buildWhazingExternalButtonPayload(cleanPhone, "Confirme ou cancele sua consulta:", buttons)),
      });
      responseText = await response.text();
    }
    if (!response.ok) {
      console.error("[uiara-28][buttons] Error:", responseText);
      return false;
    }
    console.log("[uiara-28][buttons] sent OK:", responseText.substring(0, 200));
    return true;
  } catch (err) {
    console.error("[uiara-28][buttons] Exception:", err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }
  const dryRun = body.dryRun === true;

  const { data: appts, error } = await supabase
    .from("appointments")
    .select("id, start_time, status, patients!inner(name, phone), professionals!inner(name)")
    .eq("clinic_id", CLINIC_ID)
    .eq("appointment_date", APPOINTMENT_DATE)
    .not("status", "in", "(cancelled,no_show)")
    .order("start_time");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const recipients = (appts || [])
    .filter((a: any) => (a.professionals?.name || "").toLowerCase().includes(PROF_NAME_FILTER))
    .map((a: any) => {
      const phone = normalizePhone(a.patients?.phone || "");
      if (!phone) return null;
      return {
        appointmentId: a.id,
        name: firstName(a.patients?.name || ""),
        phone,
        time: String(a.start_time).slice(0, 5),
      };
    })
    .filter(Boolean) as Array<{ appointmentId: string; name: string; phone: string; time: string }>;

  if (dryRun) {
    return new Response(JSON.stringify({
      success: true, dryRun: true, total: recipients.length,
      preview: recipients.map((r, i) => ({
        ...r, message: templates[i % templates.length](r.name, r.time),
      })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const processing = (async () => {
    let sent = 0, buttons = 0, failed = 0;
    console.log(`[uiara-28] starting ${recipients.length} reminders`);
    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      const message = templates[i % templates.length](r.name, r.time);
      try {
        // 1) text via Evolution
        const { error: sendErr } = await supabase.functions.invoke("send-whatsapp", {
          body: { phone: r.phone, message, clinicId: CLINIC_ID, type: "custom" },
        });
        if (sendErr) throw sendErr;
        sent++;
        await supabase.from("message_logs").insert({
          clinic_id: CLINIC_ID,
          message_type: "uiara_apr28_reminder",
          phone: r.phone,
          sent_at: new Date().toISOString(),
          month_year: "2026-04",
        });
        console.log(`[uiara-28] text ${sent}/${recipients.length} -> ${r.phone} (${r.name})`);

        // RC1 — Política informativa: não enviar botões Confirmar/Cancelar.
      } catch (err) {
        failed++;
        console.error(`[uiara-28] FAIL ${r.phone}:`, err);
      }
      if (i < recipients.length - 1) await sleep(INTERVAL_MS);
    }
    console.log(`[uiara-28] done: text=${sent} buttons=${buttons} failed=${failed}`);
  })();

  (globalThis as any).EdgeRuntime?.waitUntil?.(processing);

  return new Response(JSON.stringify({
    success: true,
    total: recipients.length,
    intervalMinutes: 3,
    estimatedMinutes: Math.max(0, (recipients.length - 1) * 3),
    recipients: recipients.map((r) => ({ phone: r.phone, name: r.name, time: r.time })),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});