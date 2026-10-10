// Consulta/submete à Meta o template UTILITY "homologacao_protocolo" (informativo, sem botões).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireStaff, authErrorResponse } from "../_shared/authGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-template-task-key",
  "Content-Type": "application/json",
};

const GRAPH = "https://graph.facebook.com/v21.0";
const WABA_ID = "2063797207822998";
const TEMPLATE_NAME = "homologacao_protocolo";
const LANGUAGE = "pt_BR";

// Deve casar com os 4 parâmetros enviados por send-homologacao-protocol.
const BODY_TEXT =
  "Protocolo de Homologação: seu atendimento de homologação foi registrado no Sindicato dos Comerciários.\n\n" +
  "Funcionário: {{1}}\n" +
  "Empresa: {{2}}\n" +
  "Data: {{3}}\n" +
  "Protocolo: {{4}}\n\n" +
  "Guarde este número de protocolo para consultas futuras sobre este atendimento.";

const TEMPLATE_COMPONENTS = [
  {
    type: "BODY",
    text: BODY_TEXT,
    example: { body_text: [["Carlos Pereira", "Comercial ABC LTDA", "20/06/2026", "HOM-2026-00123"]] },
  },
  { type: "FOOTER", text: "Sindicato dos Comerciários" },
];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const taskKey = Deno.env.get("TEMPLATE_TASK_KEY");
  const machineAuthorized = !!taskKey && req.headers.get("x-template-task-key") === taskKey;
  if (!machineAuthorized) {
    try {
      await requireStaff(req);
    } catch (e) {
      const denied = authErrorResponse(e, corsHeaders);
      if (denied) return denied;
      throw e;
    }
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: secret } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
  const token = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");
  if (!token) return json({ success: false, error: "META_TOKEN_NOT_CONFIGURED" }, 400);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = String(body.action ?? "status");

  if (action === "status") {
    const r = await fetch(`${GRAPH}/${WABA_ID}/message_templates?name=${TEMPLATE_NAME}&fields=name,status,rejected_reason,category,quality_score&limit=5`, { headers: { Authorization: `Bearer ${token}` } });
    const b = await r.json().catch(() => ({}));
    const tpl = (b?.data ?? []).find((t: any) => t.name === TEMPLATE_NAME) ?? null;
    return json({ success: r.ok, template: TEMPLATE_NAME, status: tpl?.status ?? "NOT_FOUND", raw: tpl, error: r.ok ? undefined : b });
  }

  if (action === "create") {
    const r = await fetch(`${GRAPH}/${WABA_ID}/message_templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: TEMPLATE_NAME, language: LANGUAGE, category: "UTILITY", components: TEMPLATE_COMPONENTS }),
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
