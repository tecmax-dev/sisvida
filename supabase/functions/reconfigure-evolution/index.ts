import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_URL = "https://evo.tecmax.net";
const API_KEY = "6c8f93184aa33562af34f1cb40c46091";
const WEBHOOK_URL = "https://czmnkrurkzuerrcjzbkp.supabase.co/functions/v1/whatsapp-webhook";

async function evoFetch(path: string, method = "GET", body?: unknown) {
  const headers: Record<string, string> = { 'apikey': API_KEY };
  if (body) headers['Content-Type'] = 'application/json';
  
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { action } = await req.json();
    const results: Record<string, unknown> = {};

    if (action === 'check') {
      // List all existing instances
      const all = await evoFetch('/instance/fetchInstances');
      results.existing_instances = all.data;
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'setup') {
      const instances = ['eclini', 'secmi', '73f527a6_1768840057737'];
      
      for (const inst of instances) {
        // Check if instance exists
        const check = await evoFetch(`/instance/fetchInstances?instanceName=${inst}`);
        const exists = Array.isArray(check.data) && check.data.length > 0;
        
        if (!exists) {
          // Create instance
          const create = await evoFetch('/instance/create', 'POST', {
            instanceName: inst,
            qrcode: true,
          });
          results[`create_${inst}`] = { status: create.status, data: create.data };
        } else {
          results[`exists_${inst}`] = true;
        }

        // Set webhook
        const webhook = await evoFetch(`/webhook/set/${inst}`, 'POST', {
          webhook: {
            enabled: true,
            url: WEBHOOK_URL,
            webhookByEvents: false,
            webhookBase64: false,
            events: ['MESSAGES_UPSERT']
          }
        });
        results[`webhook_${inst}`] = { status: webhook.status, data: webhook.data };

        // Check connection state
        const state = await evoFetch(`/instance/connectionState/${inst}`);
        results[`state_${inst}`] = { status: state.status, data: state.data };
      }

      return new Response(JSON.stringify(results, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Use action: "check" or "setup"' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
