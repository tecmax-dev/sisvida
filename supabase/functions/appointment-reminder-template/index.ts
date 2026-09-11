import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireStaff, authErrorResponse } from "../_shared/authGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const GRAPH = "https://graph.facebook.com/v21.0";
const WABA_ID = "2063797207822998";
const TEMPLATE_NAME = "lembrete_consulta_v4";
const LANGUAGE = "pt_BR";
const PUBLIC_BASE_URL = Deno.env.get("PUBLIC_APP_BASE_URL") || "https://sindexa.com.br";
const SECURE_ROUTE = "/consulta";

// UTILITY, informativo. Sem Quick Reply, sem "responda SIM/NÃO".
// Único botão é URL (não induz resposta no WhatsApp) e leva ao canal oficial.
const BODY_TEXT =
  "Olá, {{1}}.\n" +
  "Lembramos que você possui um atendimento agendado para:\n" +
  "Data: {{2}}\n" +
  "Horário: {{3}}\n" +
  "Profissional: {{4}}\n\n" +
  "Para gerenciar seu atendimento, utilize o botão abaixo (canal oficial).\n" +
  "Esta é uma comunicação automática referente a um serviço previamente agendado.";

const TEMPLATE_COMPONENTS = [
  {
    type: "BODY",
    text: BODY_TEXT,
    example: { body_text: [["João", "quinta-feira, 12 de março", "09:30", "Dra. Karen Freire"]] },
  },
  { type: "FOOTER", text: "Sindicato dos Comerciários" },
  {
    type: "BUTTONS",
    buttons: [
      {
        type: "URL",
        text: "Gerenciar atendimento",
        url: `${PUBLIC_BASE_URL}${SECURE_ROUTE}/{{1}}`,
        example: [`${PUBLIC_BASE_URL}${SECURE_ROUTE}/exemplotoken00000000000000000000`],
      },
    ],
  },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const taskKey = Deno.env.get("TEMPLATE_TASK_KEY");
  const providedKey = req.headers.get("x-template-task-key");
  const machineAuthorized = !!taskKey && providedKey === taskKey;

  if (!machineAuthorized) {
    try {
      await requireStaff(req);
    } catch (authErr) {
      const denied = authErrorResponse(authErr, corsHeaders);
      if (denied) return denied;
      throw authErr;
    }
  }


  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: secret } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
  const token = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2") || Deno.env.get("META_WHATSAPP_TOKEN");
  if (!token) return json({ success: false, error: "META_TOKEN_NOT_CONFIGURED" }, 400);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = String(body.action ?? "status");

  if (action === "status") {
    const r = await fetch(
      `${GRAPH}/${WABA_ID}/message_templates?name=${TEMPLATE_NAME}&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const b = await r.json().catch(() => ({}));
    const tpl = (b?.data ?? []).find((t: any) => t.name === TEMPLATE_NAME) ?? null;
    return json({ success: r.ok, template: TEMPLATE_NAME, status: tpl?.status ?? "NOT_FOUND", raw: tpl });
  }

  if (action === "create") {
    const r = await fetch(`${GRAPH}/${WABA_ID}/message_templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: TEMPLATE_NAME,
        language: LANGUAGE,
        category: "UTILITY",
        components: TEMPLATE_COMPONENTS,
      }),
    });
    const b = await r.json().catch(() => ({}));
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "TEMPLATE_SUBMIT",
      decision: r.ok ? "SUBMITTED" : "FAILED",
      metadata: { template: TEMPLATE_NAME, http: r.status, response: b },
    });
    return json({ success: r.ok, http: r.status, response: b });
  }

  return json({ success: false, error: "UNKNOWN_ACTION" }, 400);
});
