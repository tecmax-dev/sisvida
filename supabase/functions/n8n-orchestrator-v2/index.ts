import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { requireStaff, authErrorResponse } from "../_shared/authGuard.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-prosinge-key, x-prosinge-timestamp, x-prosinge-nonce, x-prosinge-signature',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    await requireStaff(req);
  } catch (authErr) {
    const denied = authErrorResponse(authErr, corsHeaders);
    if (denied) return denied;
    throw authErr;
  }

  
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    
    const { data: config } = await supabase
      .from('chatwoot_configs')
      .select('chatwoot_base_url, chatwoot_api_token_secret_name')
      .eq('chatwoot_account_id', '1')
      .single();
    
    const chatwootUrl = config.chatwoot_base_url;
    const chatwootToken = Deno.env.get(config.chatwoot_api_token_secret_name) || Deno.env.get('CHATWOOT_API_KEY');
    
    const responseText = "Olá, Sergio. Identificamos seu clique para atualizar a carteirinha. Envie seu contracheque mais recente aqui mesmo para prosseguirmos.";

    const chatwootPost = await fetch(`${chatwootUrl}/api/v1/accounts/1/conversations/156/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': chatwootToken!
      },
      body: JSON.stringify({
        content: responseText,
        message_type: 'outgoing'
      })
    });
    const postResult = await chatwootPost.json();

    return new Response(JSON.stringify({ 
      decision: 'DELIVERED', 
      message_id: postResult.id,
      mode: 'REPAIRED_SYNCHRONOUS_V2_4_HARDCORE' 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});