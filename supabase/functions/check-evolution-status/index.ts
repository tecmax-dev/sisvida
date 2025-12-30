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
    // Try to get from request body first (for testing from admin panel)
    let apiUrl: string | undefined;
    let apiKey: string | undefined;
    let instanceName: string | undefined;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        apiUrl = body.api_url;
        apiKey = body.api_key;
        instanceName = body.instance_name;
        console.log('[check-evolution-status] Using params from request body');
      } catch {
        console.log('[check-evolution-status] No valid JSON body, using env vars');
      }
    }

    // Fall back to environment variables
    if (!apiUrl) apiUrl = Deno.env.get('EVOLUTION_API_URL');
    if (!apiKey) apiKey = Deno.env.get('EVOLUTION_API_KEY');
    if (!instanceName) instanceName = Deno.env.get('EVOLUTION_INSTANCE');

    console.log('[check-evolution-status] Config:', {
      url: apiUrl,
      instance: instanceName,
      keyLength: apiKey?.length || 0
    });

    if (!apiUrl || !apiKey || !instanceName) {
      return new Response(
        JSON.stringify({ 
          connected: false, 
          error: 'Evolution API não configurada - preencha todos os campos',
          config: {
            hasUrl: !!apiUrl,
            hasKey: !!apiKey,
            hasInstance: !!instanceName
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize URL
    apiUrl = apiUrl.replace(/\/+$/, '');

    // Check connection state
    console.log(`[check-evolution-status] Fetching: ${apiUrl}/instance/connectionState/${instanceName}`);
    
    const stateResponse = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
      },
    });

    const stateText = await stateResponse.text();
    console.log(`[check-evolution-status] State response (${stateResponse.status}): ${stateText}`);

    if (!stateResponse.ok) {
      let errorMsg = 'Erro ao conectar com a API';
      if (stateResponse.status === 401) {
        errorMsg = 'API Key inválida ou expirada';
      } else if (stateResponse.status === 404) {
        errorMsg = `Instância "${instanceName}" não encontrada`;
      }
      
      return new Response(
        JSON.stringify({ 
          connected: false, 
          error: errorMsg,
          status: stateResponse.status,
          details: stateText.substring(0, 200)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let stateData;
    try {
      stateData = JSON.parse(stateText);
    } catch {
      stateData = { raw: stateText };
    }

    // Determine if connected based on state
    const state = stateData?.instance?.state || stateData?.state;
    const isConnected = state === 'open' || state === 'connected';

    return new Response(
      JSON.stringify({ 
        connected: isConnected,
        state: state || 'unknown',
        instance: instanceName,
        details: stateData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-evolution-status] Error:', error);
    return new Response(
      JSON.stringify({ 
        connected: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
