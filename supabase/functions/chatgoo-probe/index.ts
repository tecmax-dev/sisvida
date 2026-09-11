import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_PHONE_NUMBER_ID = "1213495528515111";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: secret } = await supabase.rpc("get_meta_vault_secret", {
    _secret_name: "META_WHATSAPP_TOKEN_V2",
  });
  const token = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");
  if (!token) {
    return new Response(JSON.stringify({ error: "META_TOKEN_MISSING" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  const body = await req.json().catch(() => ({}));
  const to = typeof body.to === "string" ? body.to : null;

  const infoRes = await fetch(
    `https://graph.facebook.com/v20.0/${META_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,quality_rating,platform_type,throughput`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const info = await infoRes.text();

  let send: unknown = null;
  if (to) {
    const res = await fetch(`https://graph.facebook.com/v20.0/${META_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: "Teste de entrega do atendimento automático do sindicato." },
      }),
    });
    send = { status: res.status, body: await res.text() };
  }

  return new Response(JSON.stringify({ phone_info: { status: infoRes.status, body: info }, send }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
