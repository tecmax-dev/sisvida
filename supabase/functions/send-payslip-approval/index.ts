import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApprovalRequest {
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  card_id?: string;
  new_expires_at?: string | null;
  notes?: string;
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

    const candidates = new Set<string>();
    candidates.add(formattedPhone);
    const national = formattedPhone.slice(2);
    if (national.length === 10) {
      const ddd = national.slice(0, 2);
      const rest = national.slice(2);
      if (!rest.startsWith('9')) candidates.add('55' + ddd + '9' + rest);
    } else if (national.length === 11) {
      const ddd = national.slice(0, 2);
      const rest = national.slice(2);
      if (rest.startsWith('9')) candidates.add('55' + ddd + rest.slice(1));
    }

    try {
      const checkResp = await fetch(`${config.api_url}/chat/whatsappNumbers/${config.instance_name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': config.api_key },
        body: JSON.stringify({ numbers: Array.from(candidates) }),
      });
      if (checkResp.ok) {
        const checkData = await checkResp.json();
        if (Array.isArray(checkData)) {
          const valid = checkData.find((n: any) => n?.exists === true);
          if (valid?.jid) {
            formattedPhone = String(valid.jid).split('@')[0];
            console.log(`[send-payslip-approval] Resolved JID for ${phone}: ${formattedPhone}`);
          } else {
            return { success: false, error: 'Número não está registrado no WhatsApp' };
          }
        }
      }
    } catch (checkErr) {
      console.warn('[send-payslip-approval] JID check failed:', checkErr);
    }

    const response = await fetch(`${config.api_url}/message/sendText/${config.instance_name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': config.api_key },
      body: JSON.stringify({ number: formattedPhone, text: message }),
    });

    const responseText = await response.text();
    console.log(`[send-payslip-approval] Evolution API response: ${response.status} - ${responseText}`);

    if (!response.ok) return { success: false, error: `API error ${response.status}: ${responseText}` };
    return { success: true };
  } catch (error) {
    console.error('[send-payslip-approval] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

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

    const { clinic_id, patient_id, patient_name, patient_phone, new_expires_at, notes }: ApprovalRequest = await req.json();

    console.log('[send-payslip-approval] Processing', { clinic_id, patient_id, patient_name, new_expires_at });

    const { data: clinic } = await supabase.from('clinics').select('name').eq('id', clinic_id).single();
    if (!clinic) throw new Error('Clínica não encontrada');

    const { data: evolutionConfig } = await supabase
      .from('evolution_configs')
      .select('api_url, api_key, instance_name, is_connected')
      .eq('clinic_id', clinic_id)
      .eq('is_connected', true)
      .single();

    if (!evolutionConfig) {
      return new Response(
        JSON.stringify({ success: true, whatsapp_sent: false, message: 'WhatsApp não configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firstName = (patient_name || '').split(' ')[0] || patient_name;
    const expiryBR = formatDateBR(new_expires_at);

    const message = `✅ Olá, ${firstName}!

Seu contracheque foi *aprovado* com sucesso! 🎉

Sua carteirinha de associado(a) está renovada${expiryBR ? ` e válida até *${expiryBR}*` : ''}.${notes ? `\n\n📝 *Observações:* ${notes}` : ''}

Agora você pode continuar utilizando todos os benefícios e serviços do sindicato normalmente.

Obrigado pela confiança!
Equipe ${clinic.name}`;

    const result = await sendWhatsAppText(evolutionConfig as EvolutionConfig, patient_phone, message);

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
