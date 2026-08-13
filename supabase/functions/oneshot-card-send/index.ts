import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateConsentForCurrentPhone } from "../_shared/whatsappConsentGate.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const PHONE_ID = "1213495528515111";
const BUILD = "ONESHOT-CARD-2026-08-11-A";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { cpf, to_override } = await req.json().catch(() => ({} as any));

  const digits = String(cpf ?? "").replace(/\D/g, "");
  const { data: patients } = await admin.from("patients").select("id,name,phone,cpf").limit(500);
  const p = (patients ?? []).find((x: any) => String(x.cpf ?? "").replace(/\D/g, "") === digits);
  if (!p && !to_override) {
    return new Response(JSON.stringify({ error: "PATIENT_NOT_FOUND", build: BUILD }), { status: 404, headers: cors });
  }

  // new token
  const tokenRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/card-update-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
    body: JSON.stringify({ action: "generate", cpf: digits }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData?.token) {
    return new Response(JSON.stringify({ error: "TOKEN_GENERATE_FAILED", tokenData, build: BUILD }), { status: 500, headers: cors });
  }

  const { data: secret } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
  const metaToken = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");

  let to = String(to_override ?? p?.phone ?? "").replace(/\D/g, "");
  if (!to.startsWith("55")) to = `55${to}`;

  // GATE: consentimento deve corresponder ao telefone ATUAL do destinatário
  const gate = await validateConsentForCurrentPhone(admin, to, { personId: p?.id ?? null });
  if (!gate.allow) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "URL_TEMPLATE_ONESHOT",
      decision: "BLOCKED",
      metadata: { build: BUILD, to, reasons: gate.reasons, consent_phone_stored: gate.consent_phone_stored },
    });
    return new Response(JSON.stringify({ ok: false, blocked: true, reasons: gate.reasons, whatsapp_sent: 0, build: BUILD }), { status: 200, headers: cors });
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: "carteirinha_atualizacao_link",
      language: { code: "pt_BR" },
      components: [
        { type: "body", parameters: [{ type: "text", text: (p?.name ?? "Associado").split(" ")[0] }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: tokenData.token }] },
      ],
    },
  };

  const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await res.json();

  await admin.from("whatsapp_compliance_logs").insert({
    intent: "URL_TEMPLATE_ONESHOT",
    decision: res.status === 200 ? "SENT" : "SEND_FAILED",
    metadata: { build: BUILD, to, http: res.status, response: result, token_expires_at: tokenData.expires_at },
  });

  return new Response(JSON.stringify({ ok: res.status === 200, http: res.status, to, result, url: tokenData.url, build: BUILD }), { headers: cors });
});
