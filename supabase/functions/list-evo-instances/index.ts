import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!.replace(/\/+$/, '');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

    console.log(`[list-instances] Fetching from ${evolutionApiUrl}/instance/fetchInstances`);

    const response = await fetch(`${evolutionApiUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: { 'apikey': evolutionApiKey },
    });

    const data = await response.json();
    
    // Extract just names for clarity
    const instances = Array.isArray(data) 
      ? data.map((i: any) => ({ name: i.instance?.instanceName || i.instanceName, id: i.instance?.instanceId || i.id, status: i.instance?.status || i.status }))
      : data;

    console.log(`[list-instances] Found:`, JSON.stringify(instances));

    return new Response(JSON.stringify({ ok: true, instances }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
