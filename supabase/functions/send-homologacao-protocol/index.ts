// Envia o protocolo de homologação pelo WhatsApp oficial (template UTILITY aprovado)
// para as partes envolvidas (empresa e trabalhador), cada uma com gates próprios de
// consentimento, opt-out e auditoria. Uma única tentativa por destinatário (sem retry).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateConsentForCurrentPhone, normalizeBrPhone } from "../_shared/whatsappConsentGate.ts";
import { requireStaff, authErrorResponse } from "../_shared/authGuard.ts";
import { chatwootMirrorTemplateSent } from "../_shared/chatwoot-client.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};
const BUILD = "HOMOLOG-PROTOCOL-2026-10-10-C";
const PHONE_ID = "1213495528515111";
const WABA_ID = "2063797207822998";
const TEMPLATE = "protocolo_homologacao_v1";
const GRAPH = "https://graph.facebook.com/v21.0";
const INTENT = "HOMOLOGACAO_PROTOCOL";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: cors });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    await requireStaff(req);
  } catch (e) {
    const denied = authErrorResponse(e, cors);
    if (denied) return denied;
    throw e;
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({} as any));
  const appointmentId = String(body.appointmentId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(appointmentId)) return json({ ok: false, error: "APPOINTMENT_ID_REQUIRED", build: BUILD }, 400);
  const targets: string[] = Array.isArray(body.targets) && body.targets.length ? body.targets : ["company", "employee"];

  const { data: appt } = await admin
    .from("homologacao_appointments")
    .select("id, clinic_id, appointment_date, protocol_number, employee_name, company_name, company_phone, employee_phone, professional:homologacao_professionals(id, name, phone), service_type:homologacao_service_types(name)")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) return json({ ok: false, error: "APPOINTMENT_NOT_FOUND", build: BUILD }, 404);
  if (!appt.protocol_number) return json({ ok: false, blocked: true, reason: "NO_PROTOCOL", build: BUILD });

  const { data: secret } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
  const metaToken = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");
  if (!metaToken) return json({ ok: false, error: "META_TOKEN_NOT_CONFIGURED", build: BUILD }, 400);

  // Fail-closed: somente com template APROVADO (consulta read-only)
  let approved = false;
  try {
    const r = await fetch(`${GRAPH}/${WABA_ID}/message_templates?name=${TEMPLATE}&limit=5`, { headers: { Authorization: `Bearer ${metaToken}` } });
    const b = await r.json().catch(() => ({} as any));
    const tpl = (b?.data ?? []).find((t: any) => t.name === TEMPLATE);
    approved = !!tpl && String(tpl.status).toUpperCase() === "APPROVED";
  } catch { /* fail-closed */ }
  if (!approved) {
    await admin.from("whatsapp_compliance_logs").insert({ intent: INTENT, decision: "TEMPLATE_NOT_AVAILABLE", metadata: { build: BUILD, appointment_id: appt.id, template: TEMPLATE } });
    return json({ ok: false, blocked: true, reason: "TEMPLATE_NOT_APPROVED", build: BUILD });
  }

  // 4 parâmetros, na ordem do template protocolo_homologacao_v1 (homologacao-protocol-template)
  const [y, m, d] = String(appt.appointment_date).split("-");
  const buildParams = (recipientName: string) =>
    [recipientName || "-", appt.company_name || "-", `${d}/${m}/${y}`, appt.protocol_number].map((t) => ({ type: "text", text: String(t) }));

  const results: Record<string, { ok: boolean; reason?: string; message_id?: string }> = {};
  const sentPhones = new Set<string>();

  for (const target of targets) {
    if (target !== "company" && target !== "employee" && target !== "professional") continue;
    const prof = (appt as any).professional;
    const raw = target === "company" ? appt.company_phone : target === "professional" ? prof?.phone : appt.employee_phone;
    const { valid, e164 } = normalizeBrPhone(raw);
    const log = (decision: string, extra: Record<string, unknown> = {}) =>
      admin.from("whatsapp_compliance_logs").insert({ intent: INTENT, decision, metadata: { build: BUILD, appointment_id: appt.id, target, ...extra } });

    if (!valid || !e164) { await log("BLOCKED", { reason: "NO_VALID_PHONE" }); results[target] = { ok: false, reason: "INVALID_PHONE" }; continue; }
    if (sentPhones.has(e164)) { results[target] = { ok: true, reason: "SAME_PHONE_ALREADY_SENT" }; continue; }

    const { data: optOut } = await admin.from("whatsapp_opt_outs").select("id").eq("clinic_id", appt.clinic_id).eq("phone", e164).maybeSingle();
    if (optOut) { await log("BLOCKED", { reason: "OPT_OUT" }); results[target] = { ok: false, reason: "OPT_OUT" }; continue; }

    const gate = await validateConsentForCurrentPhone(admin, e164, { tenantId: String(appt.clinic_id) });
    if (!gate.allow) { await log("BLOCKED", { reason: "NO_CONSENT", reasons: gate.reasons }); results[target] = { ok: false, reason: "NO_CONSENT" }; continue; }

    const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", recipient_type: "individual", to: e164, type: "template",
        template: { name: TEMPLATE, language: { code: "pt_BR" }, components: [{ type: "body", parameters: buildParams(target === "company" ? (appt.company_name || "") : target === "professional" ? (prof?.name || "") : (appt.employee_name || "")) }] },
      }),
    });
    const result = await res.json().catch(() => ({} as any));
    const messageId: string | undefined = result?.messages?.[0]?.id;
    if (res.ok && messageId) {
      sentPhones.add(e164);
      await log("SENT", { template: TEMPLATE, message_id: messageId });
      // Espelho no ZapResponde: nota privada (o envio real já saiu pela Meta; não reenvia).
      const recipientName = target === "company" ? (appt.company_name || null) : target === "professional" ? (prof?.name || null) : (appt.employee_name || null);
      await chatwootMirrorTemplateSent(admin as any, String(appt.clinic_id), e164, recipientName,
        `📄 [Modelo oficial enviado: ${TEMPLATE}]\nProtocolo de homologação ${appt.protocol_number}\nEmpresa: ${appt.company_name || "-"}\nData: ${d}/${m}/${y}\nDestinatário: ${target === "company" ? "Empresa" : target === "professional" ? "Profissional" : "Trabalhador"}`);
      results[target] = { ok: true, message_id: messageId };
    } else {
      await log("SEND_FAILED", { template: TEMPLATE, http: res.status, response: result });
      results[target] = { ok: false, reason: "SEND_FAILED" };
    }
  }

  return json({ ok: Object.values(results).some((r) => r.ok), results, build: BUILD });
});
