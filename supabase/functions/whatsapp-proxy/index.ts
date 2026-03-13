// whatsapp-proxy v1.0 - Proxy intermediário para webhook da Evolution API
// Recebe o webhook e encaminha para o eCLINI (whatsapp-webhook) e para o sistema externo (Whaticket, etc.)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Parse the incoming webhook payload from Evolution API
    const payload = await req.json();
    console.log('[whatsapp-proxy] Received webhook payload');

    // Extract instance name from the payload
    const instanceName = payload?.instance || payload?.data?.instance || null;
    if (!instanceName) {
      console.warn('[whatsapp-proxy] No instance name found in payload, forwarding anyway');
    }

    // Look up external webhook URL for this instance
    let externalWebhookUrl: string | null = null;
    if (instanceName) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: config } = await supabase
        .from('evolution_configs')
        .select('external_webhook_url')
        .eq('instance_name', instanceName)
        .maybeSingle();

      externalWebhookUrl = config?.external_webhook_url || null;
    }

    const payloadStr = JSON.stringify(payload);
    const internalUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;

    // Forward to both targets in parallel
    const forwardPromises: Promise<{ target: string; ok: boolean; status?: number; error?: string }>[] = [];

    // 1. Always forward to eCLINI's internal webhook
    forwardPromises.push(
      fetch(internalUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadStr,
      })
        .then(async (res) => {
          const body = await res.text();
          console.log(`[whatsapp-proxy] Internal webhook response: ${res.status} - ${body.substring(0, 200)}`);
          return { target: 'internal', ok: res.ok, status: res.status };
        })
        .catch((err) => {
          console.error('[whatsapp-proxy] Internal webhook error:', err.message);
          return { target: 'internal', ok: false, error: err.message };
        })
    );

    // 2. Forward to external system (Whaticket, etc.) if configured
    if (externalWebhookUrl) {
      console.log(`[whatsapp-proxy] Forwarding to external: ${externalWebhookUrl}`);
      forwardPromises.push(
        fetch(externalWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadStr,
        })
          .then(async (res) => {
            const body = await res.text();
            console.log(`[whatsapp-proxy] External webhook response: ${res.status} - ${body.substring(0, 200)}`);
            return { target: 'external', ok: res.ok, status: res.status };
          })
          .catch((err) => {
            console.error('[whatsapp-proxy] External webhook error:', err.message);
            return { target: 'external', ok: false, error: err.message };
          })
      );
    } else {
      console.log('[whatsapp-proxy] No external webhook configured, skipping');
    }

    const results = await Promise.all(forwardPromises);

    console.log('[whatsapp-proxy] Dispatch results:', JSON.stringify(results));

    return new Response(
      JSON.stringify({ 
        success: true, 
        dispatched: results.length,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[whatsapp-proxy] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
