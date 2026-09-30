import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getAuthContext, authErrorResponse, AuthError } from "../_shared/authGuard.ts";
import { normalizeBrPhone, validateConsentForCurrentPhone } from "../_shared/whatsappConsentGate.ts";
import { chatwootMirrorTemplateSent } from "../_shared/chatwoot-client.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const WABA_ID = "2063797207822998";
const PHONE_ID = "1213495528515111";
const TEMPLATE = "boas_vindas_filiacao_v2";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const actor = await getAuthContext(req);
    if (!actor) throw new AuthError("UNAUTHORIZED", 401);
    if (!actor.isStaff) throw new AuthError("FORBIDDEN", 403);
    const input = await req.json().catch(() => null);
    const associadoId = input?.associadoId;
    const patientId = input?.patientId;
    const inputClinicId = input?.clinicId;
    const viaPatient = !(typeof associadoId === "string" && UUID.test(associadoId));
    if (viaPatient && (typeof patientId !== "string" || !UUID.test(patientId))) return json({ success: false, error: "INVALID_INPUT" }, 400);
    if (viaPatient && (typeof inputClinicId !== "string" || !UUID.test(inputClinicId))) return json({ success: false, error: "INVALID_INPUT" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

    let member: { id: string; nome: string | null; telefone: string | null; status: string | null; aprovado_at: string | null; sindicato_id: string } | null = null;
    let clinicId: string;
    let patientActive = false;
    if (!viaPatient) {
      const { data, error: memberError } = await admin.from("sindical_associados")
        .select("id, nome, telefone, status, aprovado_at, sindicato_id")
        .eq("id", associadoId).maybeSingle();
      if (memberError || !data) return json({ success: false, error: "MEMBER_NOT_FOUND" }, 404);
      member = data;
      const { data: entity, error: entityError } = await admin.from("union_entities")
        .select("clinic_id").eq("id", member.sindicato_id).maybeSingle();
      if (entityError || !entity?.clinic_id) return json({ success: false, error: "ENTITY_NOT_FOUND" }, 404);
      clinicId = entity.clinic_id as string;
    } else {
      // Manual send from the members list: resolve the affiliation record by CPF
      // within the union entity of the clinic informed by the caller.
      const { data: ent } = await admin.from("union_entities")
        .select("id, clinic_id").eq("clinic_id", inputClinicId).maybeSingle();
      if (!ent?.id || !ent.clinic_id) return json({ success: false, error: "ENTITY_NOT_FOUND" }, 404);
      clinicId = ent.clinic_id as string;
      const { data: patient } = await admin.from("patients")
        .select("id, cpf, is_active").eq("id", patientId).maybeSingle();
      if (!patient?.cpf) return json({ success: false, error: "MEMBER_NOT_FOUND" }, 404);
      patientActive = patient.is_active !== false;
      const cpfDigits = String(patient.cpf).replace(/\D/g, "");
      const { data: candidates } = await admin.from("sindical_associados")
        .select("id, nome, telefone, status, aprovado_at, sindicato_id, cpf")
        .eq("sindicato_id", ent.id);
      member = (candidates ?? []).find((a) => String(a.cpf ?? "").replace(/\D/g, "") === cpfDigits) ?? null;
      // Fallback: use the patient's own data when there is no affiliation record.
      if (!member) {
        const { data: p } = await admin.from("patients")
          .select("id, name, phone").eq("id", patientId).maybeSingle();
        if (!p) return json({ success: false, error: "MEMBER_NOT_FOUND" }, 404);
        member = { id: p.id, nome: p.name, telefone: p.phone, status: "ativo", aprovado_at: null, sindicato_id: ent.id };
      }
    }
    if (!actor.isSuperAdmin) {
      const { data: allowed, error } = await admin.rpc("has_clinic_access", { _user_id: actor.userId, _clinic_id: clinicId });
      if (error || allowed !== true) throw new AuthError("FORBIDDEN", 403);
    }
    if (viaPatient) {
      if (!patientActive) return json({ success: false, reason: "NOT_APPROVED" });
    } else if (member.status !== "ativo" || !member.aprovado_at) {
      return json({ success: false, reason: "NOT_APPROVED" });
    }

    const log = async (decision: string, details: Record<string, unknown> = {}) => admin.from("whatsapp_compliance_logs").insert({
      intent: "AFFILIATION_WELCOME", decision,
      metadata: { associado_id: member.id, clinic_id: clinicId, actor_id: actor.userId, template: TEMPLATE, ...details },
    });
    const { valid, e164 } = normalizeBrPhone(member.telefone);
    if (!valid || !e164) { await log("BLOCKED", { reason: "INVALID_PHONE" }); return json({ success: false, reason: "INVALID_PHONE" }); }
    const gate = await validateConsentForCurrentPhone(admin, e164, { personId: member.id, tenantId: clinicId });
    if (!gate.allow) {
      await log("BLOCKED", { reason: gate.opt_out ? "OPT_OUT" : "NO_CONSENT", reasons: gate.reasons });
      return json({ success: false, reason: gate.opt_out ? "OPT_OUT" : "NO_CONSENT" });
    }
    const { data: secret, error: secretError } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
    const token = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");
    if (secretError || !token) return json({ success: false, reason: "META_TOKEN_NOT_CONFIGURED" });
    const check = await fetch(`${GRAPH}/${WABA_ID}/message_templates?name=${TEMPLATE}&limit=10`, { headers: { Authorization: `Bearer ${token}` } });
    const checked = await check.json().catch(() => ({}));
    const template = check.ok ? (checked?.data ?? []).find((t: { name: string; language: string }) => t.name === TEMPLATE && t.language === "pt_BR") : null;
    if (!template || String(template.status).toUpperCase() !== "APPROVED" || String(template.category).toUpperCase() !== "UTILITY") {
      await log("TEMPLATE_NOT_AVAILABLE", { status: template?.status ?? null, category: template?.category ?? null });
      return json({ success: false, reason: "TEMPLATE_NOT_APPROVED" });
    }

    // The unique index reserves one attempt per affiliation, including concurrent clicks.
    const { error: attemptError } = await log("ATTEMPT");
    if (attemptError) {
      if (attemptError.code === "23505") return json({ success: false, reason: "ALREADY_ATTEMPTED" });
      return json({ success: false, reason: "AUDIT_UNAVAILABLE" }, 500);
    }
    const firstName = String(member.nome || "Associado").replace(/[\r\n\t]/g, " ").trim().split(/\s+/)[0].slice(0, 60);
    const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: e164, type: "template",
        template: { name: TEMPLATE, language: { code: "pt_BR" }, components: [{ type: "body", parameters: [{ type: "text", text: firstName }] }] } }),
    });
    const result = await res.json().catch(() => ({}));
    const messageId = result?.messages?.[0]?.id ?? null;
    if (!res.ok || !messageId) {
      await log("SEND_FAILED", { http: res.status, error: result?.error?.message ?? null });
      return json({ success: false, reason: "SEND_FAILED" });
    }
    await log("SENT", { message_id: messageId });
    try {
      await chatwootMirrorTemplateSent(admin as any, clinicId, e164, member.nome || firstName,
        "[Boas-vindas à filiação enviadas pelo WhatsApp oficial]");
    } catch (error) { console.error("Welcome mirror failed", error); }
    return json({ success: true, message_id: messageId });
  } catch (error) {
    const denied = authErrorResponse(error, corsHeaders);
    if (denied) return denied;
    console.error("Affiliation welcome failed", error);
    return json({ success: false, reason: "SEND_FAILED" }, 500);
  }
});