// Temporária, uso único: envia à Meta somente o modelo agenda_do_dia_profissional_v1 (se ainda não existir).
import { createClient } from "npm:@supabase/supabase-js@2";
const GRAPH = "https://graph.facebook.com/v21.0";
const WABA_ID = "2063797207822998";
const TEMPLATE = "agenda_do_dia_profissional_v1";
const COMPONENTS = [
  { type: "BODY",
    text: "Olá, {{1}}. Sua agenda do dia {{2}} está disponível, com {{3}} atendimento(s) marcado(s).\n\nToque no botão abaixo para ver os horários e os nomes dos pacientes. O link é pessoal e vale até o fim do dia.",
    example: { body_text: [["Ana", "08/10/2026", "12"]] } },
  { type: "BUTTONS", buttons: [{ type: "URL", text: "Ver agenda", url: "https://prosindweb.com.br/agenda-profissional/{{1}}", example: ["https://prosindweb.com.br/agenda-profissional/abc123"] }] },
];
Deno.serve(async () => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: token } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const r0 = await (await fetch(`${GRAPH}/${WABA_ID}/message_templates?name=${TEMPLATE}`, { headers: H })).json();
  const ex = (r0?.data ?? []).find((t: any) => t.name === TEMPLATE);
  if (ex) return Response.json({ existing: ex.status, category: ex.category });
  const r = await fetch(`${GRAPH}/${WABA_ID}/message_templates`, { method: "POST", headers: H,
    body: JSON.stringify({ name: TEMPLATE, language: "pt_BR", category: "UTILITY", components: COMPONENTS }) });
  const b = await r.json().catch(() => ({}));
  await admin.from("whatsapp_compliance_logs").insert({ intent: "PROFESSIONAL_DAILY_AGENDA", decision: r.ok ? "TEMPLATE_SUBMITTED" : "TEMPLATE_SUBMIT_FAILED", metadata: { template: TEMPLATE, http: r.status, error: b?.error?.message ?? null } });
  return Response.json({ http: r.status, id: b?.id, status: b?.status, category: b?.category, error: b?.error?.message });
});
