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
const BUILD = "DEPENDENT-APPROVAL-2026-09-29-A";
const PHONE_ID = "1213495528515111";
const WABA_ID = "2063797207822998";
const GRAPH = "https://graph.facebook.com/v21.0";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: cors });

// Templates oficiais (UTILITY, sem botões). Registro somente com autorização manual (action=register, 1 tentativa).
const TEMPLATES: Record<string, { vars: number; body: string; example: string[] }> = {
  dependente_aprovado: {
    vars: 2,
    body:
      "Olá, {{1}}. A solicitação de inclusão de {{2}} como seu dependente foi aprovada pelo sindicato.\n\n" +
      "A carteirinha digital do dependente já pode ser consultada no aplicativo oficial do sindicato.",
    example: ["Maria", "João da Silva"],
  },
  dependente_recusado: {
    vars: 3,
    body:
      "Olá, {{1}}. A solicitação de inclusão de {{2}} como seu dependente não pôde ser aprovada.\n\n" +
      "Motivo: {{3}}\n\n" +
      "Para concluir, envie uma nova solicitação pelo aplicativo oficial do sindicato com a foto da frente e do verso do documento do dependente e do titular.",
    example: ["Maria", "João da Silva", "documento enviado sem o verso"],
  },
};

const clean = (s: unknown, max = 200) =>
  String(s ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    await requireStaff(req);
  } catch (e) {
    const denied = authErrorResponse(e, cors);
    if (denied) return denied;
    throw e;
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const body = await req.json().catch(() => ({} as any));
  const action = String(body.action || "send");

  const { data: secret } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
  const metaToken = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");
  if (!metaToken) return json({ ok: false, error: "META_TOKEN_NOT_CONFIGURED", build: BUILD });

  const fetchStatus = async (name: string): Promise<string> => {
    try {
      const r = await fetch(`${GRAPH}/${WABA_ID}/message_templates?name=${name}&limit=5`, {
        headers: { Authorization: `Bearer ${metaToken}` },
      });
      const b = await r.json().catch(() => ({} as any));
      const t = (b?.data ?? []).find((x: any) => x.name === name);
      return t ? String(t.status).toUpperCase() : "NOT_FOUND";
    } catch {
      return "UNKNOWN";
    }
  };

  if (action === "templates") {
    const out = [];
    for (const name of Object.keys(TEMPLATES)) out.push({ name, status: await fetchStatus(name) });
    return json({ ok: true, templates: out, build: BUILD });
  }

  if (action === "register") {
    if (body.manual_authorization !== true) return json({ ok: false, error: "MANUAL_AUTHORIZATION_REQUIRED" }, 403);
    const out = [];
    for (const [name, t] of Object.entries(TEMPLATES)) {
      const status = await fetchStatus(name);
      if (status !== "NOT_FOUND") { out.push({ name, status, created: false }); continue; }
      const r = await fetch(`${GRAPH}/${WABA_ID}/message_templates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name, language: "pt_BR", category: "UTILITY",
          components: [{ type: "BODY", text: t.body, example: { body_text: [t.example] } }],
        }),
      });
      const rb = await r.json().catch(() => ({} as any));
      out.push({ name, http: r.status, id: rb?.id ?? null, status: rb?.status ?? null, error: rb?.error?.message ?? null });
    }
    return json({ ok: true, results: out, build: BUILD });
  }

  // ---- SEND ----
  const approvalId = String(body.approval_id || "");
  const outcome = body.outcome === "rejected" ? "rejected" : body.outcome === "approved" ? "approved" : null;
  if (!approvalId || !outcome) return json({ ok: false, error: "INVALID_INPUT" }, 400);
  const templateName = outcome === "approved" ? "dependente_aprovado" : "dependente_recusado";

  const { data: ap } = await admin
    .from("pending_dependent_approvals")
    .select("id, clinic_id, patient_id, requester_phone, status, rejection_reason, dependent:patient_dependents(name), patient:patients(name, phone)")
    .eq("id", approvalId)
    .maybeSingle();
  if (!ap) return json({ ok: false, error: "NOT_FOUND" }, 404);
  if (ap.status !== outcome) return json({ ok: false, blocked: true, reason: "STATUS_MISMATCH" });

  const clinicId = ap.clinic_id as string;
  const patientId = ap.patient_id as string;
  const titular = clean((ap as any).patient?.name || "Associado", 60);
  const firstName = titular.split(" ")[0] || "Associado";
  const depName = clean((ap as any).dependent?.name || "seu dependente", 80);
  const reason = clean(ap.rejection_reason || "documentação incompleta", 300);

  const log = (decision: string, metadata: Record<string, unknown>) =>
    admin.from("whatsapp_compliance_logs").insert({
      intent: "DEPENDENT_APPROVAL", decision,
      metadata: { build: BUILD, template: templateName, approval_id: approvalId, patient_id: patientId, ...metadata },
    });

  const { valid, e164 } = normalizeBrPhone((ap as any).patient?.phone || ap.requester_phone);
  if (!valid || !e164) { await log("BLOCKED", { reason: "NO_VALID_PHONE" }); return json({ ok: false, blocked: true, reason: "INVALID_PHONE" }); }

  const { data: optOut } = await admin.from("whatsapp_opt_outs").select("id").eq("clinic_id", clinicId).eq("phone", e164).maybeSingle();
  if (optOut) { await log("BLOCKED", { reason: "OPT_OUT" }); return json({ ok: false, blocked: true, reason: "OPT_OUT" }); }

  const gate = await validateConsentForCurrentPhone(admin, e164, { personId: patientId, tenantId: clinicId });
  if (!gate.allow) { await log("BLOCKED", { reasons: gate.reasons }); return json({ ok: false, blocked: true, reason: "NO_CONSENT" }); }

  if ((await fetchStatus(templateName)) !== "APPROVED") {
    await log("TEMPLATE_NOT_AVAILABLE", {});
    return json({ ok: false, blocked: true, reason: "TEMPLATE_NOT_APPROVED" });
  }

  const params = [{ type: "text", text: firstName }, { type: "text", text: depName }];
  if (outcome === "rejected") params.push({ type: "text", text: reason });

  const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", recipient_type: "individual", to: e164, type: "template",
      template: { name: templateName, language: { code: "pt_BR" }, components: [{ type: "body", parameters: params }] },
    }),
  });
  const result: any = await res.json().catch(() => ({}));
  const messageId = result?.messages?.[0]?.id ?? null;
  if (!res.ok || !messageId) {
    await log("SEND_FAILED", { http: res.status, response: result });
    return json({ ok: false, reason: "SEND_FAILED", http: res.status, error: result?.error?.message ?? null });
  }
  await log("SENT", { message_id: messageId });

  try {
    await chatwootMirrorTemplateSent(admin as any, clinicId, e164, titular,
      `[Inclusão de dependente ${outcome === "approved" ? "aprovada" : "não aprovada"} — aviso pelo WhatsApp oficial]\n` +
        `Titular: ${titular}\nDependente: ${depName}` + (outcome === "rejected" ? `\nMotivo: ${reason}` : ""));
  } catch (_) { /* espelho opcional */ }

  return json({ ok: true, message_id: messageId, build: BUILD });
});
