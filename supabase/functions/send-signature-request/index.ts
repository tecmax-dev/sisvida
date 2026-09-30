import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getAuthContext, authErrorResponse, AuthError } from "../_shared/authGuard.ts";
import { normalizeBrPhone, validateConsentForCurrentPhone } from "../_shared/whatsappConsentGate.ts";
import { chatwootMirrorTemplateSent } from "../_shared/chatwoot-client.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const WABA_ID = "2063797207822998";
const PHONE_ID = "1213495528515111";
const TEMPLATE = "assinatura_filiacao_v1";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const actor = await getAuthContext(req);
    if (!actor) throw new AuthError("UNAUTHORIZED", 401);
    if (!actor.isStaff) throw new AuthError("FORBIDDEN", 403);

    const input = await req.json().catch(() => null);
    const associadoId = input?.associadoId;
    const clinicId = input?.clinicId;
    const official = input?.sendOfficial === true;
    if (typeof associadoId !== "string" || !uuid.test(associadoId) || typeof clinicId !== "string" || !uuid.test(clinicId)) {
      return json({ success: false, error: "ID do associado e da clínica são obrigatórios" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false },
    });
    if (!actor.isSuperAdmin) {
      const { data: access, error: accessError } = await admin.rpc("has_clinic_access", { _user_id: actor.userId, _clinic_id: clinicId });
      if (accessError || access !== true) return json({ success: false, error: "FORBIDDEN" }, 403);
    }
    const { data: patient, error: patientError } = await admin.from("patients")
      .select("id, clinic_id, name, phone").eq("id", associadoId).eq("clinic_id", clinicId).maybeSingle();
    if (patientError) return json({ success: false, error: "PATIENT_LOOKUP_FAILED" }, 500);
    if (!patient) return json({ success: false, error: "ASSOCIADO_NAO_ENCONTRADO" }, 404);

    const log = async (decision: string, details: Record<string, unknown> = {}) => {
      const { error } = await admin.from("whatsapp_compliance_logs").insert({
        intent: "AFFILIATION_SIGNATURE", decision,
        metadata: { patient_id: associadoId, clinic_id: clinicId, template: TEMPLATE, actor_id: actor.userId, ...details },
      });
      if (error) console.error("Signature notification audit error", error.message);
    };

    let e164: string | null = null;
    let metaToken: string | null = null;
    let firstName = "Associado";
    if (official) {
      const phone = normalizeBrPhone(patient.phone);
      if (!phone.valid || !phone.e164) {
        await log("BLOCKED", { reason: "INVALID_PHONE" });
        return json({ success: false, reason: "INVALID_PHONE" });
      }
      e164 = phone.e164;
      const { data: optOut, error: optOutError } = await admin.from("whatsapp_opt_outs")
        .select("id").eq("clinic_id", clinicId).eq("phone", e164).maybeSingle();
      if (optOutError || optOut) {
        await log("BLOCKED", { reason: optOutError ? "OPT_OUT_CHECK_FAILED" : "OPT_OUT" });
        return json({ success: false, reason: "OPT_OUT" });
      }
      const consent = await validateConsentForCurrentPhone(admin, e164, { personId: associadoId, tenantId: clinicId });
      if (!consent.allow) {
        await log("BLOCKED", { reason: "NO_CONSENT", reasons: consent.reasons });
        return json({ success: false, reason: "NO_CONSENT" });
      }
      const { data: secret } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
      metaToken = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2") ?? null;
      if (!metaToken) return json({ success: false, error: "META_TOKEN_NOT_CONFIGURED" }, 503);
      const statusResponse = await fetch(`${GRAPH}/${WABA_ID}/message_templates?name=${TEMPLATE}&limit=10`, {
        headers: { Authorization: `Bearer ${metaToken}` },
      });
      const statusBody = await statusResponse.json().catch(() => ({}));
      const template = statusResponse.ok ? (statusBody?.data ?? []).find((row: { name: string; language: string }) => row.name === TEMPLATE && row.language === "pt_BR") : null;
      if (!template || String(template.status).toUpperCase() !== "APPROVED") {
        await log("TEMPLATE_NOT_AVAILABLE", { meta_status: template?.status ?? null });
        return json({ success: false, reason: "TEMPLATE_NOT_APPROVED" });
      }
      firstName = String(patient.name || "Associado").replace(/[\r\n\t]/g, " ").trim().split(/\s+/)[0].slice(0, 60);
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error: insertError } = await admin.from("patient_signature_tokens")
      .insert({ token, patient_id: associadoId, clinic_id: clinicId, expires_at: expiresAt });
    if (insertError) return json({ success: false, error: "Erro ao gerar link de assinatura" }, 500);
    if (!official) return json({ success: true, token });

    // The template's dynamic URL parameter must contain ONLY the UUID suffix.
    const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", recipient_type: "individual", to: e164, type: "template",
        template: { name: TEMPLATE, language: { code: "pt_BR" }, components: [
          { type: "body", parameters: [{ type: "text", text: firstName }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: token }] },
        ] },
      }),
    });
    const result = await res.json().catch(() => ({}));
    const messageId = result?.messages?.[0]?.id ?? null;
    if (!res.ok || !messageId) {
      await log("SEND_FAILED", { http: res.status, error: result?.error?.message ?? null });
      return json({ success: false, reason: "SEND_FAILED" });
    }
    await log("SENT", { message_id: messageId });
    try {
      await chatwootMirrorTemplateSent(admin as any, clinicId, e164 as string, patient.name || firstName,
        `[Link individual para assinatura digital da filiação enviado pelo WhatsApp oficial]`);
    } catch (mirrorError) { console.error("Signature Chatwoot mirror failed", mirrorError); }
    return json({ success: true, message_id: messageId });
  } catch (error) {
    const denied = authErrorResponse(error, corsHeaders);
    if (denied) return denied;
    console.error("Signature request failed", error);
    return json({ success: false, error: "Erro ao processar solicitação de assinatura" }, 500);
  }
});
