import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// BUILD_ID: RUNTIME-FIX-V1-1213495528515111
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  
  try {
    const { action } = await req.json();

    if (action === 'runtime-audit') {
        const { data: secret } = await admin.rpc('get_meta_vault_secret', { _secret_name: 'META_WHATSAPP_TOKEN_V2' });
        const token = secret ? String(secret) : Deno.env.get('META_WHATSAPP_TOKEN_V2');
        
        // CANÔNICO: 1213495528515111
        const phoneId = "1213495528515111";

        const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        return new Response(JSON.stringify({ 
          status: "AUDIT_COMPLETE",
          runtime_phone_id: phoneId,
          graph_http: res.status,
          graph_id: data.id,
          token_source: secret ? "vault" : "env",
          build: "RUNTIME-FIX-V1"
        }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "UNKNOWN_ACTION_AUDIT", action }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
