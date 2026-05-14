import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RejectionRequest {
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  card_id?: string;
  rejection_reason: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      clinic_id,
      patient_id,
      patient_name,
      patient_phone,
      card_id,
      rejection_reason,
    }: RejectionRequest = await req.json();

    console.log('[send-payslip-rejection] Processando', { clinic_id, patient_id, patient_name, patient_phone });

    const { data: clinic } = await supabase
      .from('clinics')
      .select('name, whatsapp_provider')
      .eq('id', clinic_id)
      .maybeSingle();

    if (!clinic) throw new Error('Clínica não encontrada');

    const provider = (clinic.whatsapp_provider || 'evolution') as string;
    const firstName = (patient_name || '').split(' ')[0] || patient_name || 'Associado(a)';
    let whatsappSent = false;
    let errorDetail: any = null;

    // 1) Meta Cloud API: template carteirinha_recusada
    if (patient_phone) {
      try {
        const metaRes = await supabase.functions.invoke('meta-send-template', {
          body: {
            to: patient_phone,
            template_name: 'carteirinha_recusada',
            variables: [firstName, rejection_reason || 'Não informado'],
          },
        });

        if (!metaRes.error && metaRes.data?.success) {
          whatsappSent = true;
          console.log('[send-payslip-rejection] Meta template enviado');
        } else {
          errorDetail = metaRes.error || metaRes.data;
          console.warn('[send-payslip-rejection] Meta template falhou:', errorDetail);
        }
      } catch (err) {
        console.error('[send-payslip-rejection] Erro meta-send-template:', err);
        errorDetail = err instanceof Error ? err.message : String(err);
      }
    }

    // 2) Fallback Evolution apenas para clínicas que NÃO são meta_official
    if (!whatsappSent && patient_phone && provider !== 'meta_official') {
      const { data: evolutionConfig } = await supabase
        .from('evolution_configs')
        .select('api_url, api_key, instance_name, is_connected')
        .eq('clinic_id', clinic_id)
        .eq('is_connected', true)
        .maybeSingle();

      if (evolutionConfig) {
        const months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
        const now = new Date();
        const currentMonth = months[now.getMonth()];
        const currentYear = now.getFullYear();
        const previousMonth = months[now.getMonth() === 0 ? 11 : now.getMonth() - 1];

        const message = `⚠️ Olá, ${firstName}!\n\nInfelizmente não foi possível aprovar seu contracheque.\n\n📋 *Motivo:* ${rejection_reason}\n\nPara renovar sua carteirinha, envie um novo contracheque:\n✅ Do mês atual (${currentMonth}/${currentYear}) ou do mês anterior (${previousMonth})\n✅ Com seu nome e data visíveis\n✅ Foto legível e completa\n\nBasta responder esta mensagem com a foto do documento atualizado.\n\nObrigado pela compreensão!\nEquipe ${clinic.name}`;

        let formattedPhone = patient_phone.replace(/\D/g, '');
        if (!formattedPhone.startsWith('55')) formattedPhone = '55' + formattedPhone;

        try {
          const response = await fetch(`${evolutionConfig.api_url}/message/sendText/${evolutionConfig.instance_name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evolutionConfig.api_key },
            body: JSON.stringify({ number: formattedPhone, text: message }),
          });
          if (response.ok) {
            whatsappSent = true;
          } else {
            errorDetail = `Evolution API error: ${await response.text()}`;
          }
        } catch (err) {
          errorDetail = err instanceof Error ? err.message : String(err);
        }
      }
    }

    // Cria nova solicitação pendente para reenvio
    const { error: insertError } = await supabase
      .from('payslip_requests')
      .insert({
        clinic_id,
        patient_id,
        card_id,
        status: 'pending',
        notes: `Aguardando reenvio após rejeição: ${rejection_reason}`,
        requested_at: new Date().toISOString(),
      });

    if (insertError) console.error('[send-payslip-rejection] Erro criando solicitação pendente:', insertError);

    return new Response(
      JSON.stringify({
        success: true,
        whatsapp_sent: whatsappSent,
        error: errorDetail,
        message: whatsappSent
          ? 'Notificação enviada e nova solicitação criada'
          : 'Nova solicitação criada (notificação WhatsApp falhou ou indisponível)',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[send-payslip-rejection] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
