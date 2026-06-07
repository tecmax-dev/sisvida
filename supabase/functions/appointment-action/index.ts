import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function html(title: string, message: string, color: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7f9;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.card{background:#fff;border-radius:16px;padding:32px 24px;max-width:380px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.08);text-align:center}
.dot{width:64px;height:64px;border-radius:50%;background:${color};margin:0 auto 16px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:32px;font-weight:bold}
h1{font-size:20px;margin:0 0 8px;color:#111}
p{color:#555;margin:0;font-size:15px;line-height:1.5}
.brand{margin-top:24px;font-size:12px;color:#999}
</style></head><body><div class="card">
<div class="dot">${color === "#16a394" ? "✓" : color === "#dc2626" ? "✕" : "!"}</div>
<h1>${title}</h1><p>${message}</p>
<div class="brand">ProsindWeb</div>
</div></body></html>`;
}

function respond(title: string, message: string, color: string, status = 200) {
  return new Response(html(title, message, color), {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = (url.searchParams.get("t") || "").trim();
    const action = url.searchParams.get("x") === "1" ? "cancel" : "confirm";

    if (!token) {
      return respond("Link inválido", "Token não informado.", "#dc2626", 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error } = await supabase
      .from("appointment_sms_tokens")
      .select("token, appointment_id, expires_at, confirmed_at, cancelled_at")
      .eq("token", token)
      .maybeSingle();

    if (error || !row) {
      return respond("Link inválido", "Não foi possível localizar este agendamento.", "#dc2626", 404);
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      return respond("Link expirado", "Entre em contato com a clínica.", "#dc2626", 410);
    }

    if (row.confirmed_at || row.cancelled_at) {
      const already = row.cancelled_at ? "cancelado" : "confirmado";
      return respond(
        already === "cancelado" ? "Já cancelado" : "Já confirmado",
        `Seu agendamento já foi ${already}.`,
        already === "cancelado" ? "#dc2626" : "#16a394",
      );
    }

    const { data: appt } = await supabase
      .from("appointments")
      .select("id, status, clinic_id, appointment_date, start_time")
      .eq("id", row.appointment_id)
      .maybeSingle();

    if (!appt) {
      return respond("Agendamento não encontrado", "Entre em contato com a clínica.", "#dc2626", 404);
    }

    if (["completed", "cancelled", "no_show"].includes(appt.status)) {
      return respond(
        "Não é possível alterar",
        `Este agendamento já está ${appt.status === "cancelled" ? "cancelado" : "finalizado"}.`,
        "#999999",
        409,
      );
    }

    const ip = req.headers.get("x-forwarded-for") || "";
    const now = new Date().toISOString();

    if (action === "cancel") {
      await supabase.from("appointments").update({
        status: "cancelled",
        cancelled_at: now,
        cancellation_reason: "Cancelado pelo paciente via SMS",
      }).eq("id", appt.id);

      await supabase.from("appointment_sms_tokens").update({
        cancelled_at: now, action_ip: ip,
      }).eq("token", token);

      return respond(
        "Agendamento cancelado",
        "Recebemos sua resposta. Para reagendar, entre em contato com a clínica.",
        "#dc2626",
      );
    }

    await supabase.from("appointments").update({
      status: "confirmed",
      confirmed_at: now,
    }).eq("id", appt.id);

    await supabase.from("appointment_sms_tokens").update({
      confirmed_at: now, action_ip: ip,
    }).eq("token", token);

    return respond(
      "Agendamento confirmado!",
      "Obrigado por confirmar. Aguardamos você no horário marcado.",
      "#16a394",
    );
  } catch (e) {
    console.error("[appointment-action]", e);
    return respond("Erro", "Tente novamente em instantes.", "#dc2626", 500);
  }
});