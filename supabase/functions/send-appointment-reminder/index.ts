import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateConsentForCurrentPhone, normalizeBrPhone } from "../_shared/whatsappConsentGate.ts";
import { requireStaff, authErrorResponse } from "../_shared/authGuard.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const BUILD = "APPT-REMINDER-URL-2026-09-11-A";
const PHONE_ID = "1213495528515111";
const TEMPLATE_NAME = "lembrete_consulta_v4";
// Sem fallback: apenas o template oficial acima é usado.
const GRAPH = "https://graph.facebook.com/v21.0";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: cors });

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function formatDatePt(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    await requireStaff(req);
  } catch (authErr) {
    const denied = authErrorResponse(authErr, cors);
    if (denied) return denied;
    throw authErr;
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const body = await req.json().catch(() => ({} as any));
  const appointmentId = String(body.appointmentId ?? "");
  const force = body.force === true; // reenvio manual explícito (staff)
  if (!appointmentId) return json({ ok: false, error: "APPOINTMENT_ID_REQUIRED", build: BUILD }, 400);

  const { data: appt, error: apptErr } = await admin
    .from("appointments")
    .select(
      "id, clinic_id, status, appointment_date, start_time, reminder_sent, confirmation_token, patient_id, dependent_id, " +
        "patient:patients(id, name, phone), dependent:patient_dependents(id, name), professional:professionals(id, name)",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (apptErr || !appt) return json({ ok: false, error: "APPOINTMENT_NOT_FOUND", build: BUILD }, 404);

  if (["cancelled", "completed", "no_show"].includes(String(appt.status))) {
    return json({ ok: false, blocked: true, reason: "APPOINTMENT_NOT_ELIGIBLE", build: BUILD });
  }

  // Política: apenas UM lembrete por agendamento (sem follow-up automático).
  if (appt.reminder_sent && !force) {
    return json({ ok: false, blocked: true, reason: "REMINDER_ALREADY_SENT", build: BUILD });
  }

  const patient: any = appt.patient;
  const dependent: any = appt.dependent;
  const professional: any = appt.professional;
  const displayName = String(dependent?.name || patient?.name || "Associado");
  const { valid, e164 } = normalizeBrPhone(patient?.phone);
  if (!valid || !e164) return json({ ok: false, blocked: true, reason: "INVALID_PHONE", build: BUILD });

  // Opt-out da clínica tem precedência absoluta
  const { data: optOut } = await admin
    .from("whatsapp_opt_outs")
    .select("id")
    .eq("clinic_id", appt.clinic_id)
    .eq("phone", e164)
    .maybeSingle();

  if (optOut) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "APPOINTMENT_REMINDER",
      decision: "BLOCKED",
      metadata: { build: BUILD, appointment_id: appt.id, reason: "OPT_OUT" },
    });
    return json({ ok: false, blocked: true, reason: "OPT_OUT", build: BUILD });
  }

  const gate = await validateConsentForCurrentPhone(admin, e164, { personId: patient?.id ?? null });
  if (!gate.allow) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "APPOINTMENT_REMINDER",
      decision: "BLOCKED",
      metadata: { build: BUILD, appointment_id: appt.id, reasons: gate.reasons },
    });
    return json({ ok: false, blocked: true, reason: "NO_CONSENT", reasons: gate.reasons, build: BUILD });
  }

  // Token seguro do link oficial (confirmar / reagendar / cancelar fora do WhatsApp)
  let token = appt.confirmation_token as string | null;
  if (!token) {
    token = randomToken();
    const { error: tokenErr } = await admin
      .from("appointments")
      .update({ confirmation_token: token })
      .eq("id", appt.id);
    if (tokenErr) return json({ ok: false, error: "TOKEN_PERSIST_FAILED", details: tokenErr.message, build: BUILD }, 500);
  }

  const { data: secret } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
  const metaToken = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");
  if (!metaToken) return json({ ok: false, error: "META_TOKEN_NOT_CONFIGURED", build: BUILD }, 400);

  const bodyParams = [
    { type: "text", text: displayName.split(" ")[0] },
    { type: "text", text: formatDatePt(String(appt.appointment_date)) },
    { type: "text", text: String(appt.start_time).slice(0, 5) },
    { type: "text", text: String(professional?.name || "Profissional") },
  ];

  const send = async (templateName: string, withButton: boolean) => {
    const components: unknown[] = [{ type: "body", parameters: bodyParams }];
    if (withButton) {
      components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: token }] });
    }
    const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: e164,
        type: "template",
        template: { name: templateName, language: { code: "pt_BR" }, components },
      }),
    });
    return { res, result: await res.json().catch(() => ({})) };
  };

  // Uso exclusivo do template oficial criado (lembrete_consulta_v4).
  // Enquanto não estiver aprovado pela Meta, o envio é bloqueado (fail-closed), sem fallback.
  const templateUsed = TEMPLATE_NAME;
  const { res, result } = await send(TEMPLATE_NAME, true);

  if (!res.ok) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "APPOINTMENT_REMINDER",
      decision: "TEMPLATE_NOT_AVAILABLE",
      metadata: { build: BUILD, appointment_id: appt.id, template: templateUsed, http: res.status, response: result },
    });
    return json({
      ok: false,
      blocked: true,
      reason: "TEMPLATE_NOT_APPROVED",
      template: templateUsed,
      http: res.status,
      result,
      build: BUILD,
    }, 200);
  }


  await admin.from("whatsapp_compliance_logs").insert({
    intent: "APPOINTMENT_REMINDER",
    decision: res.ok ? "SENT" : "SEND_FAILED",
    metadata: { build: BUILD, appointment_id: appt.id, template: templateUsed, http: res.status, response: result },
  });

  if (res.ok) {
    await admin.from("appointments").update({ reminder_sent: true }).eq("id", appt.id);
  }

  return json({ ok: res.ok, http: res.status, template: templateUsed, result, build: BUILD });
});
