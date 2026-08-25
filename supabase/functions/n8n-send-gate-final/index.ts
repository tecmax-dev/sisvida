import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { validateConsentForCurrentPhone } from "../_shared/whatsappConsentGate.ts"
import { requireStaff, authErrorResponse } from "../_shared/authGuard.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
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

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const { cpf, token: webToken } = await req.json();
    const { data: secret } = await admin.rpc('get_meta_vault_secret', { _secret_name: 'META_WHATSAPP_TOKEN_V2' });
    const metaToken = secret ? String(secret) : Deno.env.get('META_WHATSAPP_TOKEN_V2');
    
    const digits = String(cpf).replace(/\D/g, '');
    const { data: patient } = await admin.from('patients').select('phone').or(`cpf.eq.${digits},cpf.eq.${digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '..-')}`).maybeSingle();

    const to = String(patient?.phone ?? '').replace(/\D/g, '');

    // GATE: consentimento deve corresponder ao telefone ATUAL do destinatário
    const gate = await validateConsentForCurrentPhone(admin, to);
    if (!gate.allow) {
      return new Response(JSON.stringify({
        blocked: true,
        decision: 'BLOCK',
        reasons: gate.reasons,
        consent_phone_stored: gate.consent_phone_stored,
        whatsapp_sent: 0,
      }), { status: 200, headers: corsHeaders });
    }
    const phoneId = "1213495528515111";
    
    const payload = {
      messaging_product: "whatsapp",
      to: to.startsWith('55') ? to : `55${to}`,
      type: "template",
      template: {
        name: "carteirinha_atualizacao_link",
        language: { code: "pt_BR" },
        components: [{
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: webToken }]
        }]
      }
    };

    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${metaToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    return new Response(JSON.stringify({ status: res.status, result }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
