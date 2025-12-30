import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE');

    console.log('[check-evolution-status] Config:', {
      url: EVOLUTION_API_URL,
      instance: EVOLUTION_INSTANCE,
      keyLength: EVOLUTION_API_KEY?.length || 0
    });

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Evolution API não configurada',
          config: {
            hasUrl: !!EVOLUTION_API_URL,
            hasKey: !!EVOLUTION_API_KEY,
            hasInstance: !!EVOLUTION_INSTANCE
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize URL
    let apiUrl = EVOLUTION_API_URL.replace(/\/+$/, '');

    // Check connection state
    console.log(`[check-evolution-status] Fetching: ${apiUrl}/instance/connectionState/${EVOLUTION_INSTANCE}`);
    
    const stateResponse = await fetch(`${apiUrl}/instance/connectionState/${EVOLUTION_INSTANCE}`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY,
      },
    });

    const stateText = await stateResponse.text();
    console.log(`[check-evolution-status] State response (${stateResponse.status}): ${stateText}`);

    let stateData;
    try {
      stateData = JSON.parse(stateText);
    } catch {
      stateData = { raw: stateText };
    }

    // Check instance info
    console.log(`[check-evolution-status] Fetching: ${apiUrl}/instance/fetchInstances`);
    
    const instancesResponse = await fetch(`${apiUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY,
      },
    });

    const instancesText = await instancesResponse.text();
    console.log(`[check-evolution-status] Instances response (${instancesResponse.status}): ${instancesText.substring(0, 500)}`);

    let instancesData;
    try {
      instancesData = JSON.parse(instancesText);
    } catch {
      instancesData = { raw: instancesText };
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        config: {
          url: EVOLUTION_API_URL,
          instance: EVOLUTION_INSTANCE
        },
        connectionState: {
          status: stateResponse.status,
          data: stateData
        },
        instances: {
          status: instancesResponse.status,
          data: instancesData
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-evolution-status] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
