import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const WABA_ID = "2063797207822998";
const GRAPH = "https://graph.facebook.com/v21.0";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: tokenData } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
  const token = typeof tokenData === "string" ? tokenData : (tokenData as any)?.secret ?? tokenData;
  if (!token) return new Response(JSON.stringify({ ok: false, error: "NO_TOKEN" }), { status: 500, headers: cors });

  const names = ["lembrete_consulta_v5", "lembrete_consulta_v4", "vaga_disponivel_v1"];
  const out: any[] = [];
  for (const name of names) {
    const res = await fetch(`${GRAPH}/${WABA_ID}/message_templates?name=${encodeURIComponent(name)}&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await res.json();
    const items = j?.data ?? [];
    for (const t of items) {
      const buttons: any[] = [];
      for (const c of t.components ?? []) {
        if (c.type === "BUTTONS") {
          for (const b of c.buttons ?? []) buttons.push({ text: b.text, url: b.url });
        }
      }
      out.push({ name: t.name, status: t.status, category: t.category, buttons });
    }
    if (!items.length) out.push({ name, status: "NOT_FOUND" });
  }
  // Nunca retorna o token.
  return new Response(JSON.stringify({ ok: true, templates: out }), { headers: cors });
});
