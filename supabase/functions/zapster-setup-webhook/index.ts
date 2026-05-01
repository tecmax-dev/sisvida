// zapster-setup-webhook v1.0
// Cria/atualiza o webhook na Zapster para receber mensagens da instância
// configurada para uma clínica. Aponta o webhook para nosso endpoint zapster-webhook.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ZAP_RESPONDER_BASE_URL = "https://api.zapresponder.com.br/api/whatsapp";

const DEFAULT_EVENTS = [
  "message.received",
  "message.updated",
  "instance.connected",
  "instance.disconnected",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData } = await authClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (!claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clinicId } = await req.json();
    if (!clinicId) {
      return new Response(JSON.stringify({ error: "clinicId obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica permissão de admin da clínica
    const { data: isAdmin } = await supabase.rpc("is_clinic_admin", {
      _user_id: userId,
      _clinic_id: clinicId,
    });
    const { data: superAdmin } = await supabase
      .from("super_admins")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!isAdmin && !superAdmin) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiToken = Deno.env.get("ZAPSTER_API_TOKEN");
    if (!apiToken) {
      return new Response(JSON.stringify({ error: "ZAPSTER_API_TOKEN não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cfg } = await supabase
      .from("zapster_configs")
      .select("instance_id, webhook_id")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (!cfg?.instance_id) {
      return new Response(JSON.stringify({ error: "Instância Zap Responder ainda não associada à clínica" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/zapster-webhook`;

    // Zap Responder: POST /api/whatsapp/webhook/{departmentId}
    const endpoint = `${ZAP_RESPONDER_BASE_URL}/webhook/${cfg.instance_id}`;

    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ webhook: webhookUrl }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("[zapster-setup-webhook] error:", r.status, data);
      return new Response(
        JSON.stringify({ error: `Zapster ${r.status}`, details: data }),
        { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Zap Responder geralmente retorna 200 OK sem corpo complexo para esta rota
    await supabase
      .from("zapster_configs")
      .update({ webhook_id: "active" }) // Marcamos como ativo
      .eq("clinic_id", clinicId);

    return new Response(
      JSON.stringify({ success: true, webhook_id: "active", webhook_url: webhookUrl, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[zapster-setup-webhook] error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
