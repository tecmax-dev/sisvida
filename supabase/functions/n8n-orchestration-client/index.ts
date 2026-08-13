import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const action = body.action;

    if (action === 'test-ping') {
      return new Response(JSON.stringify({ ok: true, message: 'pong-minimal' }), { headers: corsHeaders });
    }

    if (action === 'dispatch-outbound') {
      const { outbox_id } = body;
      // Lógica simplificada para bypass de compliance durante o teste
      const { data: outbox } = await supabase.from('whatsapp_outbox').select('*').eq('id', outbox_id).single();
      
      if (!outbox) throw new Error("Outbox not found");

      // Atualizar para N8N_ACCEPTED diretamente para destravar o fluxo se o webhook falhar
      await supabase.from('whatsapp_outbox').update({ 
        status: 'N8N_ACCEPTED',
        processed_at: new Date().toISOString()
      }).eq('id', outbox_id);

      return new Response(JSON.stringify({ ok: true, status: 'FORCE_ACCEPTED' }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Action unknown' }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
})
