import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatDateBR(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  try {
    const [y, m, d] = dateStr.split('T')[0].split('-');
    if (y && m && d) return `${d}/${m}/${y}`;
  } catch (_) {}
  return dateStr;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

     const { clinic_id, patient_id, patient_name, patient_phone, new_expires_at, notes } = await req.json();
 
     console.log('[send-payslip-approval] Processing', { clinic_id, patient_id, patient_name, new_expires_at });
 
     const firstName = (patient_name || '').split(' ')[0] || patient_name;
     const expiryBR = formatDateBR(new_expires_at);
 
     // Prioritize Meta Template if available (needed for closed 24h window)
     const { data: metaConfig } = await supabase.from('whatsapp_configs').select('*').limit(1).maybeSingle();
     
     let whatsapp_sent = false;
     let error_detail = null;
 
     if (metaConfig) {
       console.log('[send-payslip-approval] Attempting Meta Template notification');
       try {
         const templateName = new_expires_at ? 'carteirinha_atualizada' : 'contracheque_aprovado';
         const variables = new_expires_at ? [firstName, expiryBR] : [firstName];
 
         const metaRes = await supabase.functions.invoke('meta-send-template', {
           body: {
             to: patient_phone,
             template_name: templateName,
             variables
           }
         });
 
         if (!metaRes.error) {
           whatsapp_sent = true;
           console.log('[send-payslip-approval] Meta Template sent successfully');
         } else {
           console.warn('[send-payslip-approval] Meta Template failed:', metaRes.error);
           error_detail = metaRes.error;
         }
       } catch (err) {
         console.error('[send-payslip-approval] Error calling meta-send-template:', err);
       }
     }
 
     // Fallback to Evolution API (text message) if Meta failed or not configured
     if (!whatsapp_sent) {
       const { data: evolutionConfig } = await supabase
         .from('evolution_configs')
         .select('api_url, api_key, instance_name, is_connected')
         .eq('clinic_id', clinic_id)
         .eq('is_connected', true)
         .single();
 
       if (evolutionConfig) {
         const { data: clinic } = await supabase.from('clinics').select('name').eq('id', clinic_id).single();
         const clinicName = clinic?.name || 'Sindicato';
 
         const message = `✅ Olá, ${firstName}!
 
 Seu contracheque foi *aprovado* com sucesso! 🎉
 
 Sua carteirinha de associado(a) está renovada${expiryBR ? ` e válida até *${expiryBR}*` : ''}.${notes ? `\n\n📝 *Observações:* ${notes}` : ''}
 
 Agora você pode continuar utilizando todos os benefícios e serviços do sindicato normalmente.
 
 Obrigado pela confiança!
 Equipe ${clinicName}`;
 
         // Re-implementing simplified sendWhatsAppText logic here to avoid huge file rewrite
         let formattedPhone = patient_phone.replace(/\D/g, '');
         if (!formattedPhone.startsWith('55')) formattedPhone = '55' + formattedPhone;
 
         const response = await fetch(`${evolutionConfig.api_url}/message/sendText/${evolutionConfig.instance_name}`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', 'apikey': evolutionConfig.api_key },
           body: JSON.stringify({ number: formattedPhone, text: message }),
         });
 
         if (response.ok) {
           whatsapp_sent = true;
         } else {
           const text = await response.text();
           error_detail = `Evolution API error: ${text}`;
         }
       }
     }
 
     return new Response(
       JSON.stringify({ success: true, whatsapp_sent, error: error_detail }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );

    return new Response(
      JSON.stringify({ success: true, whatsapp_sent: result.success, error: result.success ? undefined : result.error }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[send-payslip-approval] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
