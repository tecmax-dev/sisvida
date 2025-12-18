import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvolutionRequest {
  clinicId: string;
  action: 'fetchInstances' | 'create' | 'connect' | 'connectionState' | 'logout';
  payload?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clinicId, action, payload } = await req.json() as EvolutionRequest;

    console.log(`Evolution API request: ${action} for clinic ${clinicId}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch Evolution config for this clinic
    const { data: config, error: configError } = await supabase
      .from('evolution_configs')
      .select('*')
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (configError || !config) {
      console.error('Config error:', configError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuração da Evolution API não encontrada para esta clínica' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { api_url, api_key, instance_name } = config;
    
    // Validate config
    if (!api_url || !api_key || !instance_name) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuração incompleta. Verifique URL, API Key e nome da instância.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let evolutionUrl = '';
    let method = 'GET';
    let body: string | undefined;

    switch (action) {
      case 'fetchInstances':
        evolutionUrl = `${api_url}/instance/fetchInstances?instanceName=${instance_name}`;
        break;
      
      case 'create':
        evolutionUrl = `${api_url}/instance/create`;
        method = 'POST';
        body = JSON.stringify({
          instanceName: instance_name,
          qrcode: true,
          ...payload,
        });
        break;
      
      case 'connect':
        evolutionUrl = `${api_url}/instance/connect/${instance_name}`;
        break;
      
      case 'connectionState':
        evolutionUrl = `${api_url}/instance/connectionState/${instance_name}`;
        break;
      
      case 'logout':
        evolutionUrl = `${api_url}/instance/logout/${instance_name}`;
        method = 'DELETE';
        break;
      
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Ação inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`Calling Evolution API: ${method} ${evolutionUrl}`);

    const headers: Record<string, string> = {
      'apikey': api_key,
    };
    
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const evolutionResponse = await fetch(evolutionUrl, {
      method,
      headers,
      body,
    });

    const responseText = await evolutionResponse.text();
    console.log(`Evolution API response status: ${evolutionResponse.status}`);
    console.log(`Evolution API response: ${responseText.substring(0, 500)}`);

    // Check if response is HTML (error page)
    if (responseText.startsWith('<!') || responseText.startsWith('<html')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'A API Evolution retornou uma página de erro. Verifique se a URL da API está correta.',
          details: `Status: ${evolutionResponse.status}`
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Resposta inválida da API Evolution',
          details: responseText.substring(0, 200)
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for Evolution API errors
    if (!evolutionResponse.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data.message || data.error || 'Erro na API Evolution',
          details: data
        }),
        { status: evolutionResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in evolution-api function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno ao processar requisição';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
