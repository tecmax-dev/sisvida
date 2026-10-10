import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateConsentForCurrentPhone, normalizeBrPhone } from "../_shared/whatsappConsentGate.ts";
import { requireStaff, authErrorResponse } from "../_shared/authGuard.ts";
import { chatwootMirrorTemplateSent } from "../_shared/chatwoot-client.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const BUILD = "HOMOLOG-REMINDER-2026-10-10-SVC";
const PHONE_ID = "1213495528515111";
const WABA_ID = "2063797207822998";
// Template exclusivo da homologação: mesmo padrão do lembrete de consulta,
// porém SEM o aviso de bloqueio por falta.
const TEMPLATE_PREFERRED = "lembrete_atendimento_sindical_v2"; // {{2}} = nome do serviço
const TEMPLATE_LEGACY_HOMOLOG = "lembrete_homologacao_v1"; // texto fixo "homologação": só para serviço de homologação
const GRAPH = "https://graph.facebook.com/v21.0";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: cors });

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
    .from("homologacao_appointments")
    .select(
      "id, clinic_id, status, appointment_date, start_time, reminder_sent_at, confirmation_token, " +
        "employee_name, company_name, company_contact_name, company_phone, employee_phone, " +
        "professional:professionals(id, name), service_type:homologacao_service_types(id, name)",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (apptErr || !appt) return json({ ok: false, error: "APPOINTMENT_NOT_FOUND", build: BUILD }, 404);

  if (["cancelled", "completed", "no_show"].includes(String(appt.status))) {
    return json({ ok: false, blocked: true, reason: "APPOINTMENT_NOT_ELIGIBLE", build: BUILD });
  }

  // Política: apenas UM lembrete por agendamento (sem follow-up automático).
  if (appt.reminder_sent_at && !force) {
    return json({ ok: false, blocked: true, reason: "REMINDER_ALREADY_SENT", build: BUILD });
  }

  const professional: any = (appt as any).professional;
  const displayName = String((appt as any).company_contact_name || (appt as any).company_name || "Prezado(a)");
  const { valid, e164 } = normalizeBrPhone((appt as any).company_phone);
  if (!valid || !e164) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "HOMOLOGACAO_REMINDER",
      decision: "BLOCKED",
      metadata: { build: BUILD, appointment_id: appt.id, reason: "NO_VALID_PHONE" },
    });
    return json({ ok: false, blocked: true, reason: "INVALID_PHONE", build: BUILD });
  }

  // Opt-out da clínica tem precedência absoluta
  const { data: optOut } = await admin
    .from("whatsapp_opt_outs")
    .select("id")
    .eq("clinic_id", appt.clinic_id)
    .eq("phone", e164)
    .maybeSingle();

  if (optOut) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "HOMOLOGACAO_REMINDER",
      decision: "BLOCKED",
      metadata: { build: BUILD, appointment_id: appt.id, reason: "OPT_OUT" },
    });
    return json({ ok: false, blocked: true, reason: "OPT_OUT", build: BUILD });
  }

  const gate = await validateConsentForCurrentPhone(admin, e164, { tenantId: String(appt.clinic_id) });
  if (!gate.allow) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "HOMOLOGACAO_REMINDER",
      decision: "BLOCKED",
      metadata: { build: BUILD, appointment_id: appt.id, reasons: gate.reasons },
    });
    return json({ ok: false, blocked: true, reason: "NO_CONSENT", reasons: gate.reasons, build: BUILD });
  }

  // Token seguro do link oficial (confirmar / reagendar / cancelar fora do WhatsApp)
  let token = (appt as any).confirmation_token as string | null;
  if (!token) {
    token = crypto.randomUUID();
    const { error: tokenErr } = await admin
      .from("homologacao_appointments")
      .update({ confirmation_token: token })
      .eq("id", appt.id);
    if (tokenErr) return json({ ok: false, error: "TOKEN_PERSIST_FAILED", details: tokenErr.message, build: BUILD }, 500);
  }

  const { data: secret } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
  const metaToken = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");
  if (!metaToken) return json({ ok: false, error: "META_TOKEN_NOT_CONFIGURED", build: BUILD }, 400);

  const serviceRaw = String((appt as any).service_type?.name || "").trim();
  const serviceLower = serviceRaw.toLowerCase();
  const isJuridico = serviceLower.includes("assessoria") || serviceLower.includes("jurídic") || serviceLower.includes("juridic");
  const serviceLabel = isJuridico
    ? "Assessoria Jurídica"
    : (serviceRaw || "Homologação de Rescisão");

  const baseName = { type: "text", text: displayName.split(" ").slice(0, 2).join(" ") };
  const legacyParams = [
    baseName,
    { type: "text", text: formatDatePt(String(appt.appointment_date)) },
    { type: "text", text: String(appt.start_time).slice(0, 5) },
    { type: "text", text: String(professional?.name || "Profissional") },
  ];
  const v2Params = [baseName, { type: "text", text: serviceLabel }, ...legacyParams.slice(1)];
  let bodyParams = legacyParams;

  const sendOnce = async (templateName: string) => {
    const components: unknown[] = [
      { type: "body", parameters: bodyParams },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: token }] },
    ];
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
    let result: any = {};
    try { result = await res.json(); } catch { result = {}; }
    return { res, result };
  };

  // Fail-closed: nenhum envio acontece com template PENDING/REJECTED.
  const resolveApprovedTemplate = async (): Promise<string | null> => {
    // Assessoria Jurídica NUNCA usa o template legado (que diz "homologação").
    const candidates = isJuridico ? [TEMPLATE_PREFERRED] : [TEMPLATE_PREFERRED, TEMPLATE_LEGACY_HOMOLOG];
    for (const name of candidates) {
      try {
        const r = await fetch(
          `${GRAPH}/${WABA_ID}/message_templates?name=${name}&limit=5`,
          { headers: { Authorization: `Bearer ${metaToken}` } },
        );
        const b = await r.json().catch(() => ({} as any));
        const tpl = (b?.data ?? []).find((t: any) => t.name === name);
        if (tpl && String(tpl.status).toUpperCase() === "APPROVED") return name;
      } catch {
        // segue para a próxima versão
      }
    }
    return null;
  };

  const templateUsed = await resolveApprovedTemplate();
  if (!templateUsed) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "HOMOLOGACAO_REMINDER",
      decision: "TEMPLATE_NOT_AVAILABLE",
      metadata: { build: BUILD, appointment_id: appt.id, preferred: TEMPLATE_PREFERRED, service: serviceLabel },
    });
    return json({ ok: false, blocked: true, reason: "TEMPLATE_NOT_APPROVED", build: BUILD });
  }
  bodyParams = templateUsed === TEMPLATE_PREFERRED ? v2Params : legacyParams;

  const MAX_ATTEMPTS = 3;
  let res: Response | null = null;
  let result: any = {};
  let attemptsUsed = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    attemptsUsed = attempt;
    const outcome = await sendOnce(templateUsed);
    res = outcome.res;
    result = outcome.result;

    if (res.ok) break;
    if (res.status !== 429 && res.status < 500) break;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }

  if (!res) return json({ ok: false, error: "SEND_NO_RESPONSE", build: BUILD }, 500);

  const metaMessageId: string | null = result?.messages?.[0]?.id ?? null;
  const confirmedSent = res.ok && !!metaMessageId;

  if (!confirmedSent) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "HOMOLOGACAO_REMINDER",
      decision: res.ok ? "SENT_UNCONFIRMED" : "TEMPLATE_NOT_AVAILABLE",
      metadata: { build: BUILD, appointment_id: appt.id, template: templateUsed, http: res.status, response: result, attempts: attemptsUsed },
    });
    return json({
      ok: false,
      blocked: true,
      reason: res.ok ? "SEND_NOT_CONFIRMED" : "TEMPLATE_NOT_APPROVED",
      template: templateUsed,
      http: res.status,
      result,
      attempts: attemptsUsed,
      build: BUILD,
    }, 200);
  }

  await admin.from("whatsapp_compliance_logs").insert({
    intent: "HOMOLOGACAO_REMINDER",
    decision: "SENT",
    metadata: { build: BUILD, appointment_id: appt.id, template: templateUsed, http: res.status, response: result, message_id: metaMessageId, attempts: attemptsUsed },
  });

  await admin
    .from("homologacao_appointments")
    .update({ reminder_sent_at: new Date().toISOString(), notification_status: "sent", notification_sent_at: new Date().toISOString() })
    .eq("id", appt.id);

  // Espelha no Chatwoot (nota privada) para o atendente ver o histórico.
  await chatwootMirrorTemplateSent(
    admin as any,
    String(appt.clinic_id),
    e164,
    displayName,
    `[Lembrete de ${serviceLabel} enviado pelo WhatsApp oficial]\n` +
      `Serviço: ${serviceLabel}\n` +
      `Funcionário: ${String((appt as any).employee_name || "-")}\n` +
      `Empresa: ${String((appt as any).company_name || "-")}\n` +
      `Data: ${formatDatePt(String(appt.appointment_date))} às ${String(appt.start_time).slice(0, 5)}\n` +
      `Profissional: ${String(professional?.name || "Profissional")}\n` +
      `Template: ${templateUsed}`,
  );

  return json({ ok: true, http: res.status, template: templateUsed, result, message_id: metaMessageId, attempts: attemptsUsed, build: BUILD });
});
