import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchRequest {
  clinic_id: string;
  date?: string; // YYYY-MM-DD, defaults to today
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
    console.log(`[batch] Evolution API response: ${response.status} for ${formattedPhone}`);

    if (!response.ok) {
      return { success: false, error: `API error ${response.status}: ${responseText}` };
    }

    return { success: true };
  } catch (error) {
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

    const { clinic_id, date }: BatchRequest = await req.json();

    // Date range: today (or provided date) from 00:00 to 23:59
    const targetDate = date || new Date().toISOString().split('T')[0];
    const startOfDay = `${targetDate}T00:00:00.000Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;

    console.log(`[batch] Processing payslip notifications for clinic ${clinic_id} on ${targetDate}`);

    // Get clinic info
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', clinic_id)
      .single();

    if (!clinic) {
      throw new Error('Clínica não encontrada');
    }

    // Get Evolution config
    const { data: evolutionConfig } = await supabase
      .from('evolution_configs')
      .select('api_url, api_key, instance_name, is_connected')
      .eq('clinic_id', clinic_id)
      .eq('is_connected', true)
      .single();

    if (!evolutionConfig) {
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp não configurado para esta clínica' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find attachments uploaded today in "Contra cheques" folders
    // First, find all folders with "contra cheque" in name for this clinic
    const { data: folders } = await supabase
      .from('patient_folders')
      .select('id, name, patient_id')
      .eq('clinic_id', clinic_id)
      .ilike('name', '%contra%');

    if (!folders || folders.length === 0) {
      console.log('[batch] No "Contra cheques" folders found');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Nenhuma pasta "Contra cheques" encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contraChequeFolderIds = folders
      .filter(f => f.name.toLowerCase().includes('cheque'))
      .map(f => f.id);

    console.log(`[batch] Found ${contraChequeFolderIds.length} contra cheque folders`);

    // Find attachments uploaded today in these folders
    const { data: attachments } = await supabase
      .from('patient_attachments')
      .select('id, patient_id, file_name, uploaded_at, folder_id')
      .eq('clinic_id', clinic_id)
      .in('folder_id', contraChequeFolderIds)
      .gte('uploaded_at', startOfDay)
      .lte('uploaded_at', endOfDay);

    if (!attachments || attachments.length === 0) {
      console.log('[batch] No attachments uploaded today in Contra cheques folders');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Nenhum contracheque atualizado hoje' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[batch] Found ${attachments.length} attachments to notify`);

    // Get unique patient IDs
    const uniquePatientIds = [...new Set(attachments.map(a => a.patient_id))];

    // Get patient info
    const { data: patients } = await supabase
      .from('patients')
      .select('id, name, phone')
      .in('id', uniquePatientIds);

    const patientMap = (patients || []).reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as Record<string, { id: string; name: string; phone: string | null }>);

    // Send notifications
    let sent = 0;
    let failed = 0;
    let noPhone = 0;
    const results: Array<{ patient: string; success: boolean; error?: string }> = [];

    for (const patientId of uniquePatientIds) {
      const patient = patientMap[patientId];
      if (!patient) continue;

      if (!patient.phone) {
        noPhone++;
        results.push({ patient: patient.name, success: false, error: 'Sem telefone' });
        continue;
      }

      const firstName = patient.name.split(' ')[0];
      const message = `📄 Olá, ${firstName}!

Seu *contracheque* foi atualizado pelo ${clinic.name}.

✅ O documento já está disponível na sua área do associado.

Em caso de dúvidas, entre em contato conosco.

*Equipe ${clinic.name}*`;

      // Add small delay between sends to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await sendWhatsAppText(evolutionConfig as EvolutionConfig, patient.phone, message);

      if (result.success) {
        sent++;
        results.push({ patient: patient.name, success: true });
        console.log(`[batch] ✅ Sent to ${patient.name}`);
      } else {
        failed++;
        results.push({ patient: patient.name, success: false, error: result.error });
        console.error(`[batch] ❌ Failed for ${patient.name}: ${result.error}`);
      }
    }

    console.log(`[batch] Done. Sent: ${sent}, Failed: ${failed}, No phone: ${noPhone}`);

    return new Response(
      JSON.stringify({
        success: true,
        date: targetDate,
        total_patients: uniquePatientIds.length,
        sent,
        failed,
        no_phone: noPhone,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[batch] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
