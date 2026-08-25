import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { requireStaff, authErrorResponse } from "../_shared/authGuard.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const BUILD_ID = "SEND-GATE-URL-FINAL-2026-08-11-01";
const CANONICAL_PHONE_ID = "1213495528515111";

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
    const body = await req.json().catch(() => ({}));
    const { action, cpf, template_name, language, components } = body;
    
    if (action === 'send_template') {
      const { data: secret } = await admin.rpc('get_meta_vault_secret', { _secret_name: 'META_WHATSAPP_TOKEN_V2' });
      const token = secret ? String(secret) : Deno.env.get('META_WHATSAPP_TOKEN_V2');
      
      // Resolve phone number from CPF
      const digits = String(cpf).replace(/\D/g, '');
      const { data: patient } = await admin
        .from('patients')
        .select('phone')
        .or(`cpf.eq.${digits},cpf.eq.${digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')}`)
        .limit(1)
        .maybeSingle();

      if (!patient?.phone) {
        return new Response(JSON.stringify({ error: "PATIENT_PHONE_NOT_FOUND", cpf }), { status: 404, headers: corsHeaders });
      }

      const to = patient.phone.replace(/\D/g, '');
      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to.startsWith('55') ? to : `55${to}`,
        type: "template",
        template: {
          name: template_name,
          language: { code: language || 'pt_BR' },
          components: components || []
        }
      };

      const res = await fetch(`https://graph.facebook.com/v20.0/${CANONICAL_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const result = await res.json();
      
      await admin.from('whatsapp_compliance_logs').insert({
          intent: 'SEND_TEMPLATE_ONE_SHOT',
          decision: res.status === 200 ? 'SUCCESS' : 'FAILED',
          metadata: { build: BUILD_ID, payload, result, status: res.status }
      });

      return new Response(JSON.stringify({ 
        success: res.status === 200,
        status: res.status,
        result,
        build: BUILD_ID 
      }), { headers: corsHeaders });
    }
    
    return new Response(JSON.stringify({ error: "UNKNOWN_ACTION", build: BUILD_ID }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});