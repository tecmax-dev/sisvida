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
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;
    const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    const webhookUrl = `${supabaseUrl}/functions/v1/whazing-ticket-webhook`;

    console.log(`[setup-whazing-webhook] Setting webhook on Evolution API`);
    console.log(`[setup-whazing-webhook] Instance: ${evolutionInstance}`);
    console.log(`[setup-whazing-webhook] Webhook URL: ${webhookUrl}`);
    console.log(`[setup-whazing-webhook] Evolution API: ${evolutionApiUrl}`);

    // Evolution API v2: POST /webhook/set/{instance}
    const url = `${evolutionApiUrl}/webhook/set/${evolutionInstance}`;
    
    const payload = {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: false,
      events: [
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "SEND_MESSAGE",
        "CONNECTION_UPDATE",
        "QRCODE_UPDATED",
      ],
    };

    console.log(`[setup-whazing-webhook] POST ${url}`);
    console.log(`[setup-whazing-webhook] Payload:`, JSON.stringify(payload));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log(`[setup-whazing-webhook] Response status: ${response.status}`);
    console.log(`[setup-whazing-webhook] Response body: ${responseText}`);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        ok: false, 
        error: `Evolution API returned ${response.status}`,
        details: responseData 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Also try to get current webhook config to verify
    const verifyUrl = `${evolutionApiUrl}/webhook/find/${evolutionInstance}`;
    const verifyResponse = await fetch(verifyUrl, {
      method: 'GET',
      headers: { 'apikey': evolutionApiKey },
    });
    
    let currentConfig = null;
    if (verifyResponse.ok) {
      currentConfig = await verifyResponse.json();
      console.log(`[setup-whazing-webhook] Current config:`, JSON.stringify(currentConfig));
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      message: 'Webhook configured successfully',
      webhookUrl,
      instance: evolutionInstance,
      evolutionResponse: responseData,
      currentConfig,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[setup-whazing-webhook] Error:', error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
