// zapster-list-instances v1.0
// Lista as instâncias disponíveis na conta Zap Responder (Zapster API)
// para o usuário escolher qual número associar à clínica.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ZAP_RESPONDER_BASE_URL = "https://api.zapresponder.com.br/api/whatsapp";

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: authErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiToken = Deno.env.get("ZAPSTER_API_TOKEN");
    if (!apiToken) {
      return new Response(
        JSON.stringify({ error: "ZAPSTER_API_TOKEN não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Zap Responder API Oficial Meta - Listar Departamentos
    // Endpoint inferido da documentação que usa departmentId
    // Tentamos listar os departamentos para pegar o ID que o usuário não vê no painel
    const r = await fetch(`${ZAP_RESPONDER_BASE_URL}/departments`, {
      headers: { 
        "Authorization": `Bearer ${apiToken}`,
        "Accept": "application/json"
      },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return new Response(
        JSON.stringify({ error: `Zapster ${r.status}`, details: data }),
        { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Zap Responder retorna os departamentos onde cada um é uma "instância" de WhatsApp
    const instances = Array.isArray(data) ? data.map((d: any) => ({
      id: d.id?.toString() || d.departmentId?.toString(),
      name: d.name || d.label || "Departamento",
      status: "active",
      phone_number: d.phone || d.whatsapp || null
    })) : (data?.departments || []).map((d: any) => ({
      id: d.id?.toString() || d.departmentId?.toString(),
      name: d.name,
      status: "active"
    }));

    return new Response(JSON.stringify({ success: true, instances }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[zapster-list-instances] error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
