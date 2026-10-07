import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getAuthContext } from "../_shared/authGuard.ts";
import { normalizeBrPhone } from "../_shared/whatsappConsentGate.ts";

// Recuperação de senha do app /sindicato pelo WhatsApp oficial (Meta Cloud API).
// Mensagem solicitada pelo próprio associado; modelo UTILITY aprovado com botão URL;
// link de uso único (hash), 30 minutos; limite de envios; opt-out respeitado; auditoria.
const GRAPH = "https://graph.facebook.com/v21.0";
const WABA_ID = "2063797207822998";
const PHONE_ID = "1213495528515111";
const CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";
const TEMPLATE = "redefinir_senha_app_v1";
const LANGUAGE = "pt_BR";
const TTL_MIN = 30;
const COMPONENTS = [
  {
    type: "BODY",
    text: "Olá, {{1}}. Recebemos o seu pedido para redefinir a senha do aplicativo do sindicato.\n\nToque no botão abaixo para criar uma nova senha. O link é pessoal, pode ser usado uma única vez e vale por 30 minutos. Se você não fez este pedido, ignore esta mensagem e sua senha continuará a mesma.",
    example: { body_text: [["Maria"]] },
  },
  {
    type: "BUTTONS",
    buttons: [{ type: "URL", text: "Criar nova senha", url: "https://prosindweb.com.br/sindicato/nova-senha/{{1}}", example: ["https://prosindweb.com.br/sindicato/nova-senha/abc123"] }],
  },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sha256 = async (v: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
const randomToken = () => {
  const b = new Uint8Array(24); crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const GENERIC = "Se o CPF estiver cadastrado, enviaremos um link pelo WhatsApp do celular cadastrado.";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Método não permitido" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const audit = (decision: string, metadata: Record<string, unknown>) =>
    admin.from("whatsapp_compliance_logs").insert({ intent: "APP_PASSWORD_RESET", decision, metadata: { template: TEMPLATE, ...metadata } })
      .then(({ error }) => { if (error) console.error("audit", error.message); });
  const getMetaToken = async () => {
    const { data } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
    return data ? String(data) : Deno.env.get("META_WHATSAPP_TOKEN_V2") ?? null;
  };
  const readTemplate = async (token: string) => {
    const r = await fetch(`${GRAPH}/${WABA_ID}/message_templates?name=${TEMPLATE}&limit=20`, { headers: { Authorization: `Bearer ${token}` } });
    const b: any = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false as const, http: r.status, error: b?.error?.message ?? null };
    return { ok: true as const, tpl: (b?.data ?? []).find((t: any) => t.name === TEMPLATE && t.language === LANGUAGE) ?? null };
  };

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    // ---- Gestão do modelo (somente superadmin, uma submissão, sem repetição automática)
    if (action === "submit-template" || action === "template-status") {
      const actor = await getAuthContext(req);
      if (!actor?.isSuperAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const token = await getMetaToken();
      if (!token) return json({ success: false, error: "META_TOKEN_NOT_CONFIGURED" }, 503);
      const read = await readTemplate(token);
      if (!read.ok) return json({ success: false, error: "META_LOOKUP_FAILED", http: read.http, details: read.error }, 502);
      if (read.tpl || action === "template-status") {
        return json({ success: true, created: false, status: read.tpl?.status ?? "NOT_FOUND", category: read.tpl?.category ?? null });
      }
      const res = await fetch(`${GRAPH}/${WABA_ID}/message_templates`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: TEMPLATE, language: LANGUAGE, category: "UTILITY", components: COMPONENTS }),
      });
      const rb: any = await res.json().catch(() => ({}));
      await audit(res.ok && rb?.id ? "TEMPLATE_SUBMITTED" : "TEMPLATE_SUBMIT_FAILED", { http: res.status, id: rb?.id ?? null, error: rb?.error?.message ?? null });
      if (!res.ok || !rb?.id) return json({ success: false, error: "META_SUBMISSION_FAILED", http: res.status, details: rb?.error?.message ?? null }, 502);
      return json({ success: true, created: true, status: rb?.status ?? "PENDING", category: rb?.category ?? "UTILITY" });
    }

    // ---- Pedido do associado: CPF -> link no WhatsApp
    if (action === "request") {
      const cpf = String(body?.cpf ?? "").replace(/\D/g, "");
      if (cpf.length !== 11) return json({ success: false, error: "Digite os 11 dígitos do CPF." }, 400);
      const formatted = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
      const { data: rows } = await admin.from("patients").select("id, name, phone, email, is_active")
        .eq("clinic_id", CLINIC_ID).in("cpf", [cpf, formatted]).eq("is_active", true).limit(1);
      const patient = rows?.[0];
      if (!patient) { await audit("NOT_FOUND", {}); return json({ success: true, channel: "whatsapp", message: GENERIC }); }

      const phone = normalizeBrPhone(patient.phone);
      let optedOut = false;
      if (phone.valid && phone.e164) {
        const { data: oo } = await admin.from("whatsapp_opt_outs").select("id").eq("clinic_id", CLINIC_ID).eq("phone", phone.e164).maybeSingle();
        optedOut = !!oo;
      }
      if (!phone.valid || !phone.e164 || optedOut) {
        await audit("FALLBACK_EMAIL", { patient_id: patient.id, reason: optedOut ? "OPT_OUT" : "NO_PHONE" });
        return json({ success: true, channel: "email", has_email: !!patient.email,
          message: "Não há WhatsApp disponível no seu cadastro. Use o e-mail cadastrado ou procure o sindicato." });
      }

      // Limites anti-abuso: 1 envio a cada 2 minutos e no máximo 3 em 24 horas.
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data: recent } = await admin.from("app_password_reset_links").select("created_at")
        .eq("patient_id", patient.id).gte("created_at", since).order("created_at", { ascending: false });
      if ((recent?.length ?? 0) >= 3 || (recent?.[0] && Date.now() - new Date(recent[0].created_at).getTime() < 120_000)) {
        await audit("RATE_LIMITED", { patient_id: patient.id });
        return json({ success: false, error: "Você já pediu um link há pouco. Confira seu WhatsApp ou tente mais tarde." }, 429);
      }

      const metaToken = await getMetaToken();
      if (!metaToken) return json({ success: false, error: "Serviço indisponível no momento." }, 503);
      const read = await readTemplate(metaToken);
      if (!read.ok || String(read.tpl?.status ?? "").toUpperCase() !== "APPROVED") {
        await audit("TEMPLATE_NOT_APPROVED", { patient_id: patient.id, status: read.ok ? read.tpl?.status ?? null : null });
        return json({ success: false, error: "A recuperação pelo WhatsApp ainda está sendo liberada. Procure o sindicato ou tente mais tarde." }, 503);
      }

      const token = randomToken();
      const { error: insErr } = await admin.from("app_password_reset_links").insert({
        token_hash: await sha256(token), patient_id: patient.id, clinic_id: CLINIC_ID,
        expires_at: new Date(Date.now() + TTL_MIN * 60_000).toISOString(),
      });
      if (insErr) return json({ success: false, error: "Não foi possível gerar o link." }, 500);

      const firstName = String(patient.name || "Associado").replace(/[\r\n\t]/g, " ").trim().split(/\s+/)[0].slice(0, 60);
      const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
        method: "POST", headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", recipient_type: "individual", to: phone.e164, type: "template",
          template: { name: TEMPLATE, language: { code: LANGUAGE }, components: [
            { type: "body", parameters: [{ type: "text", text: firstName }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: token }] },
          ] },
        }),
      });
      const rb: any = await res.json().catch(() => ({}));
      const messageId = rb?.messages?.[0]?.id ?? null;
      if (!res.ok || !messageId) {
        await audit("SEND_FAILED", { patient_id: patient.id, http: res.status, error: rb?.error?.message ?? null });
        return json({ success: false, error: "Não foi possível enviar pelo WhatsApp agora. Tente mais tarde." }, 502);
      }
      await audit("SENT", { patient_id: patient.id, message_id: messageId });
      return json({ success: true, channel: "whatsapp", message: GENERIC });
    }

    // ---- Link aberto: validar e trocar a senha
    if (action === "check" || action === "redeem") {
      const token = String(body?.token ?? "");
      if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return json({ success: false, error: "Link inválido." }, 400);
      const { data: link } = await admin.from("app_password_reset_links").select("id, patient_id, expires_at, used_at")
        .eq("token_hash", await sha256(token)).maybeSingle();
      if (!link || link.used_at || new Date(link.expires_at).getTime() < Date.now()) {
        return json({ success: false, error: "Este link expirou ou já foi usado. Peça um novo no aplicativo." }, 410);
      }
      if (action === "check") return json({ success: true });
      const pwd = String(body?.new_password ?? "");
      if (pwd.length < 6 || pwd.length > 72) return json({ success: false, error: "A senha deve ter entre 6 e 72 caracteres." }, 400);
      const { data: claimed } = await admin.from("app_password_reset_links").update({ used_at: new Date().toISOString() })
        .eq("id", link.id).is("used_at", null).select("id").maybeSingle();
      if (!claimed) return json({ success: false, error: "Este link já foi usado." }, 410);
      const { data: ok, error } = await admin.rpc("set_patient_password_service", { p_patient_id: link.patient_id, p_new_password: pwd });
      if (error || ok !== true) { console.error("set password", error?.message); return json({ success: false, error: "Não foi possível salvar a nova senha." }, 500); }
      await audit("PASSWORD_CHANGED", { patient_id: link.patient_id });
      return json({ success: true });
    }

    return json({ success: false, error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("app-password-reset", e);
    return json({ success: false, error: "Erro inesperado. Tente novamente." }, 500);
  }
});
