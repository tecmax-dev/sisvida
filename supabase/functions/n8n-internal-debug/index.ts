import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// BUILD_ID: SYNC-FINAL-DISPATCH-V100
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: secret } = await admin.rpc('get_meta_vault_secret', { _secret_name: 'META_WHATSAPP_TOKEN_V2' });
  const token = secret ? String(secret) : Deno.env.get('META_WHATSAPP_TOKEN_V2');

  const phoneId = "1213495528515111";
  
  const metaRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: "5573988633535",
      type: "template",
      template: {
        name: "carteirinha_atualizacao_link",
        language: { code: "pt_BR" },
        components: [
          { type: "body", parameters: [{ type: "text", text: "Sergio" }] },
          { type: "button", sub_type: "url", index: 0, parameters: [{ type: "text", text: "oneshot-debug-v100" }] }
        ]
      }
    })
  });

  const j = await metaRes.json();
  return new Response(JSON.stringify({ http: metaRes.status, meta: j, build: "DEBUG-V100" }), { headers: corsHeaders });
})
