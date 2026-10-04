import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireStaff, authErrorResponse } from "../_shared/authGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const GRAPH = "https://graph.facebook.com/v21.0";
const WABA_ID = "2063797207822998";
const BASE_TEMPLATE_NAME = "vaga_disponivel_v1";
const LANGUAGE = "pt_BR";
const PUBLIC_BASE_URL = Deno.env.get("PUBLIC_APP_BASE_URL") || "https://sindexa.com.br";
const APP_ROUTE = "/app/filas";

// UTILITY, informativo. Sem Quick Reply e sem pedir resposta no WhatsApp.
// Único botão é URL estática para o app oficial (canal de gerenciamento).
const BODY_TEXT =
  "Olá, {{1}}.\n" +
  "Abriu uma vaga na agenda em que você está na lista de espera:\n" +
  "Data: {{2}}\n" +
  "Horário: {{3}}\n" +
  "Profissional: {{4}}\n\n" +
  "Para verificar e reservar a vaga, utilize o botão abaixo (canal oficial).\n" +
  "Esta é uma comunicação automática referente a uma solicitação previamente registrada.";

const BASE_COMPONENTS = [
  {
    type: "BODY",
    text: BODY_TEXT,
    example: { body_text: [["João", "quinta-feira, 12 de março", "09:30", "Dra. Karen Freire"]] },
  },
  { type: "FOOTER", text: "Sindicato dos Comerciários" },
  {
    type: "BUTTONS",
    buttons: [
      { type: "URL", text: "Abrir aplicativo", url: `${PUBLIC_BASE_URL}${APP_ROUTE}` },
    ],
  },
];

// Modelo com link pessoal para a página que lista TODAS as vagas livres (15 dias).
const OPTIONS_NAME = "vaga_disponivel_opcoes_v1";
const OPTIONS_COMPONENTS = [
  {
    type: "BODY",
    text:
      "Olá, {{1}}! Abriram vagas na agenda de {{2}}, profissional em cuja lista de espera você está.\n\n" +
      "Toque no botão abaixo para ver todas as datas e horários livres dos próximos dias e escolher o que for melhor para você. " +
      "O link é pessoal e vale por 24 horas.",
    example: { body_text: [["João", "Dra. Karen Freire"]] },
  },
  { type: "FOOTER", text: "Sindicato dos Comerciários" },
  {
    type: "BUTTONS",
    buttons: [{ type: "URL", text: "Escolher horário", url: "https://prosindweb.com.br/escolher-horario?t={{1}}", example: ["https://prosindweb.com.br/escolher-horario?t=AbCdEf123456GhIjKl789"] }],
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
  const token = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");
  if (!token) return json({ success: false, error: "META_TOKEN_NOT_CONFIGURED" }, 400);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = String(body.action ?? "status");
  const useOptions = body.template === "opcoes";
  const TEMPLATE_NAME = useOptions ? OPTIONS_NAME : BASE_TEMPLATE_NAME;
  const TEMPLATE_COMPONENTS = useOptions ? OPTIONS_COMPONENTS : BASE_COMPONENTS;

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
