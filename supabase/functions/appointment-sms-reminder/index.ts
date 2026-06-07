import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  createSmsService,
  resolveSmsProvider,
  buildBrazilianPhoneCandidates,
  sanitizeApiBrasilError,
} from "../_shared/sms-providers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BASE_LINK = Deno.env.get("SMS_LINK_BASE") || "prosindweb.com.br/c/";
const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789"; // sem 0/1/l para não confundir

function genToken(len = 6): string {
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function firstName(name: string) {
  return stripAccents((name || "").trim().split(/\s+/)[0] || "");
}

function fmtDate(d: string) {
  // YYYY-MM-DD -> DD/MM
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

function fmtTime(t: string) {
  return t?.slice(0, 5) || "";
}

interface Payload {
  appointment_id: string;
  provider?: "comtele" | "apibrasil";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { appointment_id, provider } = (await req.json()) as Payload;
    if (!appointment_id) {
      return new Response(JSON.stringify({ error: "appointment_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: appt, error: aErr } = await admin
      .from("appointments")
      .select("id, clinic_id, status, appointment_date, start_time, patient:patients(name, phone), professional:professionals(name), clinic:clinics(name)")
      .eq("id", appointment_id)
      .maybeSingle();

    if (aErr || !appt) {
      return new Response(JSON.stringify({ error: "Agendamento não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (["completed", "cancelled", "no_show"].includes(appt.status)) {
      return new Response(JSON.stringify({ error: "Agendamento já finalizado/cancelado" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patient: any = appt.patient;
    const phone = patient?.phone;
    if (!phone) {
      return new Response(JSON.stringify({ error: "Paciente sem telefone" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gera token único
    let token = "";
    for (let i = 0; i < 5; i++) {
      const candidate = genToken(6);
      const { data: dup } = await admin.from("appointment_sms_tokens").select("token").eq("token", candidate).maybeSingle();
      if (!dup) { token = candidate; break; }
    }
    if (!token) {
      return new Response(JSON.stringify({ error: "Falha ao gerar token" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nome = firstName(patient?.name || "");
    const data = fmtDate(appt.appointment_date);
    const hora = fmtTime(appt.start_time);
    const link = `${BASE_LINK}${token}`;

    // Carrega template configurável (meta_template_name = 'appointment_reminder')
    const { data: tpl } = await admin
      .from("sms_templates")
      .select("id, body")
      .eq("meta_template_name", "appointment_reminder")
      .maybeSingle();
    const defaultBody = `ProsindWeb: {nome}, consulta {data} {hora}. Confirmar {link} | Cancelar {link}?x=1`;
    const body = (tpl?.body && tpl.body.trim()) ? tpl.body : defaultBody;
    const msg = body
      .replace(/\{nome\}/g, nome)
      .replace(/\{data\}/g, data)
      .replace(/\{hora\}/g, hora)
      .replace(/\{link\}/g, link)
      .replace(/\{token\}/g, token);

    const prov = resolveSmsProvider(provider);
    const sms = createSmsService(prov);
    const candidates = buildBrazilianPhoneCandidates(phone);
    let lastResult: any = null;
    let success = false;
    for (const number of candidates) {
      const r = await sms.send({ number, message: msg });
      lastResult = r;
      if (r.ok) { success = true; break; }
    }

    await admin.from("appointment_sms_tokens").insert({
      token,
      appointment_id: appt.id,
      clinic_id: appt.clinic_id,
      phone,
    });

    await admin.from("sms_send_logs").insert({
      template_id: tpl?.id ?? null,
      recipient: phone,
      rendered_body: msg,
      status: success ? "sent" : "error",
      provider_response: lastResult,
      error: success ? null : sanitizeApiBrasilError(lastResult?.error?.message),
      sent_by: userData.user.id,
    });

    if (success) {
      await admin.from("appointments").update({ reminder_sent: true }).eq("id", appt.id);
    }

    return new Response(JSON.stringify({
      ok: success, token, provider: prov, chars: msg.length, message: msg,
      error: success ? null : sanitizeApiBrasilError(lastResult?.error?.message),
    }), {
      status: success ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[appointment-sms-reminder]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});