import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  clinic_id: string;
  event: string;
  data: Record<string, unknown>;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
}

// Generate HMAC signature for webhook payload
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Dispatch webhook to a single endpoint
async function dispatchToWebhook(
  supabase: any,
  webhook: Webhook,
  event: string,
  data: Record<string, unknown>
): Promise<{ success: boolean; status?: number; error?: string; duration: number }> {
  const startTime = Date.now();
  
  const payload = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data
  });
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': event,
    'X-Webhook-Timestamp': new Date().toISOString(),
  };
  
  // Add signature if secret is configured
  if (webhook.secret) {
    const signature = await generateSignature(payload, webhook.secret);
    headers['X-Webhook-Signature'] = `sha256=${signature}`;
  }
  
  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payload,
    });
    
    const duration = Date.now() - startTime;
    const responseBody = await response.text();
    
    // Log the delivery
    await supabase.from('webhook_logs').insert({
      webhook_id: webhook.id,
      event,
      payload: { event, data },
      response_status: response.status,
      response_body: responseBody.substring(0, 5000), // Limit response body size
      duration_ms: duration,
    });
    
    return {
      success: response.ok,
      status: response.status,
      duration
    };
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log the error
    await supabase.from('webhook_logs').insert({
      webhook_id: webhook.id,
      event,
      payload: { event, data },
      error: errorMessage,
      duration_ms: duration,
    });
    
    return {
      success: false,
      error: errorMessage,
      duration
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { clinic_id, event, data }: WebhookPayload = await req.json();
    
    if (!clinic_id || !event || !data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: clinic_id, event, data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Dispatching webhook event: ${event} for clinic: ${clinic_id}`);
    
    // Fetch active webhooks for this clinic that subscribe to this event
    const { data: webhooks, error: fetchError } = await supabase
      .from('webhooks')
      .select('*')
      .eq('clinic_id', clinic_id)
      .eq('is_active', true)
      .contains('events', [event]);
    
    if (fetchError) {
      console.error('Error fetching webhooks:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch webhooks' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!webhooks || webhooks.length === 0) {
      console.log('No active webhooks found for this event');
      return new Response(
        JSON.stringify({ message: 'No webhooks configured for this event', dispatched: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Found ${webhooks.length} webhooks to dispatch`);
    
    // Dispatch to all matching webhooks in parallel
    const results = await Promise.all(
      webhooks.map((webhook: Webhook) => dispatchToWebhook(supabase, webhook, event, data))
    );
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`Webhook dispatch complete: ${successful} successful, ${failed} failed`);
    
    return new Response(
      JSON.stringify({
        message: 'Webhooks dispatched',
        total: webhooks.length,
        successful,
        failed,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error('Error in dispatch-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
