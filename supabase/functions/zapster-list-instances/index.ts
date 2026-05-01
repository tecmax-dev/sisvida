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

const ZAP_RESPONDER_BASE_URL = "https://api.zapresponder.com.br/api";

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

    const apiToken = Deno.env.get("ZAPRESPONDER_API_TOKEN") || Deno.env.get("ZAPSTER_API_TOKEN");
    
    if (!apiToken) {
      return new Response(
        JSON.stringify({ error: "ZAPRESPONDER_API_TOKEN não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Chamando API do Zap Responder...");
    
    // Endpoint correto: /api/departamento/all (em português, conforme documentação Zap Responder)
    let r = await fetch(`${ZAP_RESPONDER_BASE_URL}/departamento/all`, {
      headers: { 
        "Authorization": `Bearer ${apiToken}`,
        "Accept": "application/json"
      },
    });
    let data = await r.json().catch(() => ({}));
    console.log("Resposta /departamento/all status:", r.status, "body:", JSON.stringify(data).substring(0, 500));

    // Se falhar ou vier vazio, tentamos listar conexões (API não oficial/multidevice)
    let instances = [];
    
    // Normaliza resposta - pode vir como array direto ou dentro de "data"/"departamentos"
    const list = Array.isArray(data) 
      ? data 
      : (data?.data || data?.departamentos || data?.departments || []);
    
    instances = list.map((d: any) => ({
      id: (d.id || d.departmentId || d._id)?.toString(),
      name: d.nome || d.name || d.label || "Departamento",
      status: d.status || "active",
      phone_number: d.telefone || d.phone || d.whatsapp || d.numero || null
    })).filter((i: any) => i.id);

    console.log(`Retornando ${instances.length} instâncias encontradas.`);

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
