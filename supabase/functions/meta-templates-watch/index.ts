import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_VERSION = "v21.0";
const NOTIFY_PHONE = "5573988633535"; // E.164 sem '+'
const TEMPLATES_WATCH = ["homologacao_lembrete_v3", "homologacao_lembrete_profissional_v3"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const WABA_ID = Deno.env.get("META_WABA_ID");
  const TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
  const PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!WABA_ID || !TOKEN || !PHONE_ID) {
    return new Response(JSON.stringify({ error: "META_WABA_ID/META_WHATSAPP_TOKEN/META_PHONE_NUMBER_ID ausentes" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1) Pega status atual no cache local
  const { data: prev } = await supabase
    .from("whatsapp_meta_templates")
    .select("name, status")
    .in("name", TEMPLATES_WATCH);
  const prevMap = new Map((prev || []).map((r) => [r.name, r.status]));

  // 2) Consulta a Meta diretamente
  const results: Array<{ name: string; prev: string | null; current: string; changed: boolean }> = [];
  const transitions: Array<{ name: string; from: string | null; to: string }> = [];

  for (const name of TEMPLATES_WATCH) {
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${WABA_ID}/message_templates?fields=name,status&name=${encodeURIComponent(name)}&limit=5`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const j = await r.json();
    const item = (j.data || []).find((d: any) => d.name === name);
    const current = item?.status || "NOT_FOUND";
    const previous = prevMap.get(name) ?? null;
    const changed = previous !== null && previous !== current && previous === "PENDING";

    results.push({ name, prev: previous, current, changed });

    if (changed) {
      transitions.push({ name, from: previous, to: current });
      // Atualiza cache
      await supabase
        .from("whatsapp_meta_templates")
        .update({ status: current, last_synced_at: new Date().toISOString() })
        .eq("name", name)
        .eq("language", "pt_BR");
    }
  }

  // 3) Se houve transição, dispara WhatsApp via Meta Cloud (texto livre não funciona fora da janela 24h;
  //    então usamos um template existente curto. Aqui usamos confirmacao_agendamento? não - melhor texto
  //    livre dentro da janela; se falhar, tentamos um template informativo aprovado).
  if (transitions.length > 0) {
    const lines = transitions.map((t) => {
      const emoji = t.to === "APPROVED" ? "✅" : t.to === "REJECTED" ? "❌" : "ℹ️";
      return `${emoji} ${t.name}: ${t.from} → ${t.to}`;
    });
    const body = `🔔 Templates Meta atualizados:\n\n${lines.join("\n")}`;

    // Tenta texto livre (funciona se houver janela 24h aberta)
    const sendRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: NOTIFY_PHONE,
        type: "text",
        text: { body },
      }),
    });
    const sendJson = await sendRes.json();

    // Log no banco para histórico
    await supabase.from("homologacao_notification_logs").insert({
      appointment_id: null,
      clinic_id: null,
      channel: "whatsapp",
      recipient_phone: NOTIFY_PHONE,
      message: body,
      status: sendRes.ok ? "sent" : "failed",
      sent_at: sendRes.ok ? new Date().toISOString() : null,
      error_message: sendRes.ok ? null : JSON.stringify(sendJson),
    }).then(() => {}, () => {});

    return new Response(JSON.stringify({ success: true, results, transitions, notify: { ok: sendRes.ok, response: sendJson } }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, results, transitions: [] }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});