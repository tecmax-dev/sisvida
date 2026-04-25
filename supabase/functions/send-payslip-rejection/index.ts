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

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
  is_connected: boolean;
}

async function sendWhatsAppText(
  config: EvolutionConfig,
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    // Descobrir o JID real consultando a Evolution API.
    // Em alguns DDDs (especialmente Bahia/Nordeste), o número correto no WhatsApp
    // pode ser SEM o 9 mesmo sendo celular. Forçar o 9 cegamente faz a entrega falhar.
    // Geramos as duas variações (com e sem o 9) e perguntamos qual existe.
    const candidates = new Set<string>();
    candidates.add(formattedPhone);
    const national = formattedPhone.slice(2);
    if (national.length === 10) {
      const ddd = national.slice(0, 2);
      const rest = national.slice(2);
      if (!rest.startsWith('9')) {
        candidates.add('55' + ddd + '9' + rest);
      }
    } else if (national.length === 11) {
      const ddd = national.slice(0, 2);
      const rest = national.slice(2);
      if (rest.startsWith('9')) {
        candidates.add('55' + ddd + rest.slice(1));
      }
    }

    try {
      const checkResp = await fetch(`${config.api_url}/chat/whatsappNumbers/${config.instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.api_key,
        },
        body: JSON.stringify({ numbers: Array.from(candidates) }),
      });
      if (checkResp.ok) {
        const checkData = await checkResp.json();
        if (Array.isArray(checkData)) {
          const valid = checkData.find((n: any) => n?.exists === true);
          if (valid?.jid) {
            // Usa o número exato que o WhatsApp reconhece (sem o sufixo @s.whatsapp.net)
            formattedPhone = String(valid.jid).split('@')[0];
            console.log(`[send-payslip-rejection] Resolved JID for ${phone}: ${formattedPhone}`);
          } else {
            console.warn(`[send-payslip-rejection] Number ${phone} not found on WhatsApp`);
            return { success: false, error: 'Número não está registrado no WhatsApp' };
          }
        }
      }
    } catch (checkErr) {
      console.warn('[send-payslip-rejection] JID check failed, proceeding with default:', checkErr);
    }

    console.log(`[send-payslip-rejection] Sending WhatsApp to ${formattedPhone}`);

    const response = await fetch(`${config.api_url}/message/sendText/${config.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.api_key,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    const responseText = await response.text();
    console.log(`[send-payslip-rejection] Evolution API response: ${response.status} - ${responseText}`);

    if (!response.ok) {
      return { success: false, error: `API error ${response.status}: ${responseText}` };
    }

    return { success: true };
  } catch (error) {
    console.error('[send-payslip-rejection] Error sending WhatsApp:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
      rejection_reason 
    }: RejectionRequest = await req.json();

    console.log('[send-payslip-rejection] Processing rejection notification', {
      clinic_id,
      patient_id,
      patient_name,
      rejection_reason
    });

    // Get clinic info
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name, whatsapp_provider')
      .eq('id', clinic_id)
      .single();

    if (!clinic) {
      throw new Error('Clínica não encontrada');
    }

    // Get Evolution config for clinic
    const { data: evolutionConfig } = await supabase
      .from('evolution_configs')
      .select('api_url, api_key, instance_name, is_connected')
      .eq('clinic_id', clinic_id)
      .eq('is_connected', true)
      .single();

    if (!evolutionConfig) {
      console.log('[send-payslip-rejection] No Evolution instance configured for clinic');
      // Still create the pending request, just skip WhatsApp
    }

    // Get current month name in Portuguese
    const months = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    const now = new Date();
    const currentMonth = months[now.getMonth()];
    const currentYear = now.getFullYear();
    const previousMonth = months[now.getMonth() === 0 ? 11 : now.getMonth() - 1];

    // Format message
    const firstName = patient_name.split(' ')[0];
    const message = `⚠️ Olá, ${firstName}!

Infelizmente não foi possível aprovar seu contracheque.

📋 *Motivo:* ${rejection_reason}

Para renovar sua carteirinha, envie um novo contracheque:
✅ Do mês atual (${currentMonth}/${currentYear}) ou do mês anterior (${previousMonth})
✅ Com seu nome e data visíveis
✅ Foto legível e completa

Basta responder esta mensagem com a foto do documento atualizado.

Obrigado pela compreensão!
Equipe ${clinic.name}`;

    // Send WhatsApp message if Evolution is configured
    let whatsappSent = false;
    if (evolutionConfig) {
      const result = await sendWhatsAppText(evolutionConfig as EvolutionConfig, patient_phone, message);
      whatsappSent = result.success;
      if (!result.success) {
        console.error('[send-payslip-rejection] Failed to send WhatsApp:', result.error);
      } else {
        console.log('[send-payslip-rejection] WhatsApp notification sent successfully');
      }
    }

    // Create a new pending request for the patient to resubmit
    const { error: insertError } = await supabase
      .from('payslip_requests')
      .insert({
        clinic_id,
        patient_id,
        card_id,
        status: 'pending',
        notes: `Aguardando reenvio após rejeição: ${rejection_reason}`,
        requested_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('[send-payslip-rejection] Error creating new pending request:', insertError);
    } else {
      console.log('[send-payslip-rejection] New pending request created for resubmission');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        whatsapp_sent: whatsappSent,
        message: whatsappSent 
          ? 'Notificação enviada e nova solicitação criada' 
          : 'Nova solicitação criada (WhatsApp não configurado)'
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
