import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvolutionRequest {
  clinicId: string;
  action: 'fetchInstances' | 'create' | 'connect' | 'connectionState' | 'logout' | 'setWebhook' | 'getWebhook';
  payload?: Record<string, unknown>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1. Verify Authorization header exists
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[evolution-api] Missing Authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Create client with user's auth to verify identity
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error('[evolution-api] Invalid token:', authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse request body
    const { clinicId, action, payload } = await req.json() as EvolutionRequest;

    console.log(`[evolution-api] User ${user.id} requesting: ${action} for clinic ${clinicId}`);

    if (!clinicId || !action) {
      return new Response(
        JSON.stringify({ success: false, error: 'clinicId e action são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Create service role client for RPC call
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. First check if user is super admin
    const { data: isSuperAdmin } = await supabase.rpc('is_super_admin', {
      _user_id: user.id
    });

    // If not super admin, verify user is admin of this clinic
    if (!isSuperAdmin) {
      const { data: isAdmin, error: adminError } = await supabase.rpc('is_clinic_admin', {
        _user_id: user.id,
        _clinic_id: clinicId
      });

      if (adminError || !isAdmin) {
        console.error(`[evolution-api] User ${user.id} is not admin of clinic ${clinicId}`);
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem gerenciar o WhatsApp' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`[evolution-api] Access granted for user ${user.id} (superAdmin: ${isSuperAdmin})`)

    // 6. Fetch Evolution config for this clinic
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
      
      case 'setWebhook':
        evolutionUrl = `${api_url}/webhook/set/${instance_name}`;
        method = 'POST';
        const defaultWebhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
        const webhookUrl = payload?.webhookUrl as string || defaultWebhookUrl;
        body = JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            webhookBase64: false,
            events: [
              'MESSAGES_UPSERT'
            ]
          }
        });
        
        // Update webhook URL in database
        await supabase
          .from('evolution_configs')
          .update({ webhook_url: webhookUrl })
          .eq('clinic_id', clinicId);
        
        console.log(`[evolution-api] Setting webhook for ${instance_name} to ${webhookUrl}`);
        break;
      
      case 'getWebhook':
        evolutionUrl = `${api_url}/webhook/find/${instance_name}`;
        break;
      
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Ação inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`[evolution-api] User ${user.id} calling Evolution API: ${method} ${evolutionUrl}`);

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
