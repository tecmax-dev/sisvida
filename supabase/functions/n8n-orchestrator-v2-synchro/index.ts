import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// BUILD_ID: SYNC-2026-08-11-10-CONFIRMATION
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    
    const event = body.event;
    const conversationId = body.conversation_id || 156;

    const { data: config } = await supabase
      .from('chatwoot_configs')
      .select('chatwoot_base_url, chatwoot_api_token_secret_name')
      .eq('chatwoot_account_id', '1')
      .single();
    
    const chatwootUrl = config.chatwoot_base_url;
    const chatwootToken = Deno.env.get(config.chatwoot_api_token_secret_name) || Deno.env.get('CHATWOOT_API_KEY');

    if (event === 'payslip_received') {
        const patientName = body.patient_name || 'Associado';
        const responseText = `Olá, ${patientName}. Recebemos seu contracheque para atualização da carteirinha.\n\nO documento foi encaminhado para análise. Assim que a atualização for concluída, você será informado por aqui.`;

        const chatwootPost = await fetch(`${chatwootUrl}/api/v1/accounts/1/conversations/${conversationId}/messages`, {
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
        return new Response(JSON.stringify({ status: 'CONFIRMATION_SENT', cw: postResult }), { headers: corsHeaders });
    }

    const responseText = "Olá! Identificamos seu interesse em atualizar sua carteirinha. Para prosseguir, por favor, envie uma foto ou PDF do seu contracheque mais recente aqui mesmo.";
    const chatwootPost = await fetch(`${chatwootUrl}/api/v1/accounts/1/conversations/${conversationId}/messages`, {
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

    await supabase.from('whatsapp_compliance_logs').insert({
        conversation_id: String(conversationId),
        intent: 'REQUEST_PAYSLIP',
        decision: 'AUTO_REPLIED_SYNC',
        chatwoot_message_id: String(postResult.id || ''),
        metadata: { build: 'SYNC-2026-08-11-10', response_sent: responseText }
    });

    return new Response(JSON.stringify({ decision: 'DELIVERED', message_id: postResult.id, build_id: 'SYNC-2026-08-11-10' }), { headers: corsHeaders });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
