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
const BUILD = "PAYSLIP-REJECTION-2026-09-26-A";
const PHONE_ID = "1213495528515111";
const WABA_ID = "2063797207822998";
const GRAPH = "https://graph.facebook.com/v21.0";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: cors });

// Templates oficiais de reprovação de contracheque (UTILITY, sem botões).
export const TEMPLATES: Record<string, { vars: number; body: string; example: string[] }> = {
  contracheque_recusado_sem_desconto: {
    vars: 2,
    body:
      "Olá, {{1}}. Analisamos o contracheque enviado para a atualização da sua carteirinha de associado e ele não pôde ser aprovado.\n\n" +
      "Motivo: no contracheque não consta o desconto da contribuição {{2}}.\n\n" +
      "Para concluir a atualização, envie um novo contracheque com o desconto pelo aplicativo oficial do sindicato.",
    example: ["Maria", "Taxa Negocial"],
  },
  contracheque_recusado_prazo: {
    vars: 1,
    body:
      "Olá, {{1}}. Analisamos o contracheque enviado para a atualização da sua carteirinha de associado e ele não pôde ser aprovado.\n\n" +
      "Motivo: o contracheque enviado refere-se a uma folha de pagamento com mais de 60 dias.\n\n" +
      "Para concluir a atualização, envie o contracheque mais recente pelo aplicativo oficial do sindicato.",
    example: ["Maria"],
  },
};

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
  const templateName = String(body.template_name || "");
  const tpl = TEMPLATES[templateName];
  if (!tpl) return json({ ok: false, blocked: true, reason: "NO_TEMPLATE_SELECTED", build: BUILD });

  const clinicId = String(body.clinic_id || "");
  const patientId = body.patient_id ? String(body.patient_id) : null;
  const name = String(body.patient_name || "Associado").trim();
  const contribution = String(body.contribution_name || "Taxa Negocial");
  const log = (decision: string, metadata: Record<string, unknown>) =>
    admin.from("whatsapp_compliance_logs").insert({
      intent: "PAYSLIP_REJECTION", decision, metadata: { build: BUILD, template: templateName, patient_id: patientId, ...metadata },
    });

  const { valid, e164 } = normalizeBrPhone(body.patient_phone);
  if (!valid || !e164) { await log("BLOCKED", { reason: "NO_VALID_PHONE" }); return json({ ok: false, blocked: true, reason: "INVALID_PHONE" }); }

  const { data: optOut } = await admin.from("whatsapp_opt_outs").select("id").eq("clinic_id", clinicId).eq("phone", e164).maybeSingle();
  if (optOut) { await log("BLOCKED", { reason: "OPT_OUT" }); return json({ ok: false, blocked: true, reason: "OPT_OUT" }); }

  const gate = await validateConsentForCurrentPhone(admin, e164, { personId: patientId, tenantId: clinicId });
  if (!gate.allow) { await log("BLOCKED", { reasons: gate.reasons }); return json({ ok: false, blocked: true, reason: "NO_CONSENT" }); }

  if ((await fetchStatus(templateName)) !== "APPROVED") {
    await log("TEMPLATE_NOT_AVAILABLE", {});
    return json({ ok: false, blocked: true, reason: "TEMPLATE_NOT_APPROVED" });
  }

  const params = [{ type: "text", text: name.split(" ")[0] || "Associado" }];
  if (tpl.vars === 2) params.push({ type: "text", text: contribution });

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

  await chatwootMirrorTemplateSent(admin as any, clinicId, e164, name,
    `[Contracheque reprovado — aviso enviado pelo WhatsApp oficial]\nAssociado: ${name}\nTemplate: ${templateName}` +
      (tpl.vars === 2 ? `\nContribuição sem desconto: ${contribution}` : ""));

  return json({ ok: true, message_id: messageId, build: BUILD });
});
