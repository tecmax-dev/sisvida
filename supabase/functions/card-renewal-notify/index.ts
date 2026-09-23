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

const BUILD = "CARD-RENEWAL-NOTIFY-2026-09-23-A";
const PHONE_ID = "1213495528515111";
const WABA_ID = "2063797207822998";
const GRAPH = "https://graph.facebook.com/v21.0";
const TEMPLATE_NAME = "carteirinha_atualizada_v1";
const LANGUAGE = "pt_BR";
const CATEGORY = "UTILITY";

const TEMPLATE_COMPONENTS = [
  {
    type: "BODY",
    text:
      "Olá, {{1}}! Sua carteirinha de associado foi atualizada. ✅\n\n" +
      "Nova validade: {{2}}.\n\n" +
      "Você já pode acessar sua carteirinha digital pelo aplicativo.",
    example: { body_text: [["João", "31/12/2026"]] },
  },
  { type: "FOOTER", text: "Secmi - Ilhéus e Região" },
];

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: cors });

function formatDateBr(dateStr: string): string {
  const only = String(dateStr).slice(0, 10);
  const [y, m, d] = only.split("-");
  if (!y || !m || !d) return only;
  return `${d}/${m}/${y}`;
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

  const { data: secret } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
  const metaToken = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");
  if (!metaToken) return json({ ok: false, error: "META_TOKEN_NOT_CONFIGURED", build: BUILD }, 400);

  const readTemplate = async () => {
    const r = await fetch(`${GRAPH}/${WABA_ID}/message_templates?name=${TEMPLATE_NAME}&limit=10`, {
      headers: { Authorization: `Bearer ${metaToken}` },
    });
    const b = await r.json().catch(() => ({} as any));
    return (b?.data ?? []).find((t: any) => t.name === TEMPLATE_NAME && t.language === LANGUAGE) ?? null;
  };

  // ---------------------------------------------------------------
  // Submissão MANUAL e ÚNICA do template (autorizada pelo usuário).
  // MAX_ATTEMPTS = 1 | AUTO_RETRY = false
  // ---------------------------------------------------------------
  if (body.action === "submit-template") {
    const existing = await readTemplate();
    if (existing) {
      return json({ ok: true, status: "ALREADY_EXISTS", meta_status: existing.status, build: BUILD });
    }
    const res = await fetch(`${GRAPH}/${WABA_ID}/message_templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: TEMPLATE_NAME, language: LANGUAGE, category: CATEGORY, components: TEMPLATE_COMPONENTS }),
    });
    const resBody: any = await res.json().catch(() => ({}));
    if (!res.ok || !resBody?.id) {
      return json({ ok: false, status: "SUBMISSION_FAILED", http: res.status, response: resBody, build: BUILD });
    }
    const verify = await readTemplate();
    return json({ ok: true, status: "SUBMITTED", meta_template_id: resBody.id, meta_status: verify?.status ?? resBody?.status ?? null, build: BUILD });
  }

  if (body.action === "template-status") {
    const tpl = await readTemplate();
    return json({ ok: true, found: !!tpl, meta_status: tpl?.status ?? null, build: BUILD });
  }

  // ---------------------------------------------------------------
  // Envio do aviso de carteirinha atualizada
  // ---------------------------------------------------------------
  const patientId = String(body.patientId ?? "");
  const newExpiresAt = String(body.newExpiresAt ?? "");
  if (!patientId || !newExpiresAt) return json({ ok: false, error: "PATIENT_AND_DATE_REQUIRED", build: BUILD }, 400);

  const { data: patient } = await admin
    .from("patients")
    .select("id, name, phone, clinic_id")
    .eq("id", patientId)
    .maybeSingle();

  if (!patient) return json({ ok: false, error: "PATIENT_NOT_FOUND", build: BUILD }, 404);

  const clinicId = String(body.clinicId ?? patient.clinic_id ?? "");
  const { valid, e164 } = normalizeBrPhone(patient.phone);
  if (!valid || !e164) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "CARD_RENEWED",
      decision: "BLOCKED",
      metadata: { build: BUILD, patient_id: patientId, reason: "NO_VALID_PHONE" },
    });
    return json({ ok: false, blocked: true, reason: "INVALID_PHONE", build: BUILD });
  }

  const { data: optOut } = await admin
    .from("whatsapp_opt_outs")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("phone", e164)
    .maybeSingle();

  if (optOut) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "CARD_RENEWED",
      decision: "BLOCKED",
      metadata: { build: BUILD, patient_id: patientId, reason: "OPT_OUT" },
    });
    return json({ ok: false, blocked: true, reason: "OPT_OUT", build: BUILD });
  }

  const gate = await validateConsentForCurrentPhone(admin, e164, { personId: patient.id, tenantId: clinicId });
  if (!gate.allow) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "CARD_RENEWED",
      decision: "BLOCKED",
      metadata: { build: BUILD, patient_id: patientId, reasons: gate.reasons },
    });
    return json({ ok: false, blocked: true, reason: "NO_CONSENT", reasons: gate.reasons, build: BUILD });
  }

  // Fail-closed: só envia com template APROVADO na Meta.
  const tpl = await readTemplate();
  if (!tpl || String(tpl.status).toUpperCase() !== "APPROVED") {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "CARD_RENEWED",
      decision: "TEMPLATE_NOT_AVAILABLE",
      metadata: { build: BUILD, patient_id: patientId, template: TEMPLATE_NAME, meta_status: tpl?.status ?? null },
    });
    return json({ ok: false, blocked: true, reason: "TEMPLATE_NOT_APPROVED", meta_status: tpl?.status ?? null, build: BUILD });
  }

  const firstName = String(patient.name || "Associado").split(" ")[0];
  const validity = formatDateBr(newExpiresAt);

  const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: e164,
      type: "template",
      template: {
        name: TEMPLATE_NAME,
        language: { code: LANGUAGE },
        components: [
          { type: "body", parameters: [{ type: "text", text: firstName }, { type: "text", text: validity }] },
        ],
      },
    }),
  });
  const result: any = await res.json().catch(() => ({}));
  const metaMessageId: string | null = result?.messages?.[0]?.id ?? null;

  if (!res.ok || !metaMessageId) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "CARD_RENEWED",
      decision: res.ok ? "SENT_UNCONFIRMED" : "SEND_FAILED",
      metadata: { build: BUILD, patient_id: patientId, template: TEMPLATE_NAME, http: res.status, response: result },
    });
    return json({ ok: false, blocked: true, reason: "SEND_NOT_CONFIRMED", http: res.status, result, build: BUILD });
  }

  await admin.from("whatsapp_compliance_logs").insert({
    intent: "CARD_RENEWED",
    decision: "SENT",
    metadata: { build: BUILD, patient_id: patientId, template: TEMPLATE_NAME, message_id: metaMessageId, new_expires_at: newExpiresAt },
  });

  await chatwootMirrorTemplateSent(
    admin as any,
    clinicId,
    e164,
    patient.name ?? firstName,
    `[Aviso de carteirinha atualizada enviado pelo WhatsApp oficial]\n` +
      `Associado: ${patient.name}\n` +
      `Nova validade: ${validity}\n` +
      `Template: ${TEMPLATE_NAME}`,
  );

  return json({ ok: true, message_id: metaMessageId, template: TEMPLATE_NAME, build: BUILD });
});
