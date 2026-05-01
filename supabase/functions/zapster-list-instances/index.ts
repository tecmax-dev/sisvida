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

    const apiToken = Deno.env.get("ZAPRESPONDER_API_TOKEN") || Deno.env.get("ZAPSTER_API_TOKEN");
    
    if (!apiToken) {
      return new Response(
        JSON.stringify({ error: "ZAPRESPONDER_API_TOKEN não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Chamando API do Zap Responder...");
    
    // Tentativa 1: API Oficial Meta - Listar Departamentos
    let r = await fetch(`${ZAP_RESPONDER_BASE_URL}/departments`, {
      headers: { 
        "Authorization": `Bearer ${apiToken}`,
        "Accept": "application/json"
      },
    });
    let data = await r.json().catch(() => ({}));
    console.log("Resposta API Oficial (departments):", JSON.stringify(data));

    // Se falhar ou vier vazio, tentamos listar conexões (API não oficial/multidevice)
    let instances = [];
    
    if (Array.isArray(data)) {
      instances = data.map((d: any) => ({
        id: (d.id || d.departmentId)?.toString(),
        name: d.name || d.label || "Instância",
        status: d.status || "active",
        phone_number: d.phone || d.whatsapp || null
      }));
    } else if (data?.departments) {
      instances = data.departments.map((d: any) => ({
        id: (d.id || d.departmentId)?.toString(),
        name: d.name,
        status: d.status || "active"
      }));
    }

    // Se a lista ainda estiver vazia ou com erro, tentamos o endpoint de instâncias multidevice
    if (instances.length === 0 || !r.ok) {
      console.log("Lista vazia ou erro. Tentando endpoint de instâncias multidevice...");
      const r2 = await fetch(`${ZAP_RESPONDER_BASE_URL}/instances`, {
        headers: { 
          "Authorization": `Bearer ${apiToken}`,
          "Accept": "application/json"
        },
      });
      const data2 = await r2.json().catch(() => ({}));
      console.log("Resposta API Multidevice (instances) Status:", r2.status);
      
      if (Array.isArray(data2)) {
        instances = data2.map((i: any) => ({
          id: (i.id || i.key || i.instanceId)?.toString(),
          name: i.name || i.instanceName || "WhatsApp",
          status: i.status || "connected",
          phone_number: i.number || i.phone || null
        }));
      } else if (data2?.instances) {
        instances = data2.instances.map((i: any) => ({
          id: (i.id || i.key || i.instanceId)?.toString(),
          name: i.name,
          status: i.status
        }));
      }
    }

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
