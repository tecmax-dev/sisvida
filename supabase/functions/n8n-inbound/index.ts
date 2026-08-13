import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// BUILD_ID: SYNC-2026-08-11-06
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const rawBody = await req.text();
    const body = JSON.parse(rawBody || '{}');
    
    console.log(`[INBOUND-SYNC-2026-08-11-06] WEBHOOK_RECEIVED:`, rawBody);

    const message = body.message || {};
    const content = message.content || body.content || "";
    const conversationId = message.conversation_id || body.conversation?.id || body.conversation_id || 156;
    
    // Procura por REQUEST_PAYSLIP em qualquer lugar do objeto
    const bodyStr = JSON.stringify(body);
    const hasIntent = bodyStr.includes('REQUEST_PAYSLIP');

    if (hasIntent) {
        console.log(`[INBOUND-SYNC-2026-08-11-06] MATCHED: REQUEST_PAYSLIP intent detected in body.`);
        
        const orchRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/n8n-orchestrator-v2-synchro`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event: 'message_created',
                conversation_id: conversationId,
                content: 'REQUEST_PAYSLIP',
                payload: body
            })
        });
        
        const orchData = await orchRes.json();
        
        await supabase.from('whatsapp_compliance_logs').insert({
            conversation_id: String(conversationId),
            intent: 'REQUEST_PAYSLIP',
            decision: 'SYNCHRO_FORWARDED',
            metadata: { orch_response: orchData, inbound_body: body }
        });

        return new Response(JSON.stringify({ 
            status: 'FORWARDED', 
            orchestrator: orchData,
            build_id: 'SYNC-2026-08-11-06'
        }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    return new Response(JSON.stringify({ 
        status: 'IGNORED', 
        reason: 'NO_INTENT_DETECTED',
        build_id: 'SYNC-2026-08-11-06'
    }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (e: any) {
    console.error(`[INBOUND-SYNC] Error:`, e.message);
    return new Response(JSON.stringify({ error: e.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});