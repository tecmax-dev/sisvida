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

    console.log('[send-payslip-approval] Processing', { clinic_id, patient_id, patient_name, new_expires_at, patient_phone });

    if (!patient_phone) {
      return new Response(
        JSON.stringify({ success: false, whatsapp_sent: false, error: 'patient_phone ausente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firstName = (patient_name || '').split(' ')[0] || patient_name || 'Associado(a)';
    const expiryBR = formatDateBR(new_expires_at);

    const { data: clinic } = await supabase
      .from('clinics')
      .select('name, whatsapp_provider')
      .eq('id', clinic_id)
      .maybeSingle();

    const provider = (clinic?.whatsapp_provider || 'evolution') as string;
    let whatsapp_sent = false;
    let error_detail: any = null;

    // 1) Tentativa via Meta Cloud API (sempre tentar; obrigatório para sindicato)
    try {
      const templateName = new_expires_at ? 'carteirinha_atualizada' : 'contracheque_aprovado';
      const variables = new_expires_at ? [firstName, expiryBR || ''] : [firstName];

      const metaRes = await supabase.functions.invoke('meta-send-template', {
        body: {
          to: patient_phone,
          template_name: templateName,
          variables,
        },
      });

      if (!metaRes.error && metaRes.data?.success) {
        whatsapp_sent = true;
        console.log('[send-payslip-approval] Meta template enviado:', templateName);
      } else {
        error_detail = metaRes.error || metaRes.data;
        console.warn('[send-payslip-approval] Meta template falhou:', error_detail);
      }
    } catch (err) {
      console.error('[send-payslip-approval] Erro chamando meta-send-template:', err);
      error_detail = err instanceof Error ? err.message : String(err);
    }

    // 2) Fallback para Evolution APENAS se a clínica NÃO for meta_official
    if (!whatsapp_sent && provider !== 'meta_official') {
      const { data: evolutionConfig } = await supabase
        .from('evolution_configs')
        .select('api_url, api_key, instance_name, is_connected')
        .eq('clinic_id', clinic_id)
        .eq('is_connected', true)
        .maybeSingle();

      if (evolutionConfig) {
        const clinicName = clinic?.name || 'Sindicato';
        const message = `✅ Olá, ${firstName}!\n\nSeu contracheque foi *aprovado* com sucesso! 🎉\n\nSua carteirinha de associado(a) está renovada${expiryBR ? ` e válida até *${expiryBR}*` : ''}.${notes ? `\n\n📝 *Observações:* ${notes}` : ''}\n\nObrigado pela confiança!\nEquipe ${clinicName}`;

        let formattedPhone = patient_phone.replace(/\D/g, '');
        if (!formattedPhone.startsWith('55')) formattedPhone = '55' + formattedPhone;

        try {
          const response = await fetch(`${evolutionConfig.api_url}/message/sendText/${evolutionConfig.instance_name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evolutionConfig.api_key },
            body: JSON.stringify({ number: formattedPhone, text: message }),
          });
          if (response.ok) {
            whatsapp_sent = true;
          } else {
            error_detail = `Evolution API error: ${await response.text()}`;
          }
        } catch (err) {
          error_detail = err instanceof Error ? err.message : String(err);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, whatsapp_sent, error: error_detail }),
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
