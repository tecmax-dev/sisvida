import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUILD_ID = "SYNC-UPLOAD-2026-08-11-01";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const patientId = formData.get('patientId') as string;
    const clinicId = formData.get('clinicId') as string;
    const cardId = formData.get('cardId') as string;

    if (!file || !patientId || !clinicId || !cardId) {
      return new Response(JSON.stringify({ error: 'MISSING_FIELDS' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const fileExt = file.name.split('.').pop();
    const filePath = `${clinicId}/${patientId}/${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('payslips')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: request, error: requestError } = await supabase
      .from('payslip_requests')
      .insert({
        patient_id: patientId,
        clinic_id: clinicId,
        card_id: cardId,
        attachment_path: filePath,
        status: 'received',
        requested_at: new Date().toISOString(),
        received_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (requestError) throw requestError;

    const { data: patient } = await supabase.from('patients').select('name, phone').eq('id', patientId).single();
    
    // Disparar orquestração de confirmação sem bloquear o upload
    if (patient) {
        edgeNotify(supabase, patientId, clinicId, request.id, patient.name, patient.phone);
    }

    return new Response(JSON.stringify({ success: true, requestId: request.id, build_id: BUILD_ID }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function edgeNotify(supabase: any, patientId: string, clinicId: string, requestId: string, patientName: string, phone: string) {
  try {
    const { data: lastLog } = await supabase
      .from('whatsapp_compliance_logs')
      .select('conversation_id')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastLog?.conversation_id) {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/n8n-orchestrator-v2-synchro`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event: 'payslip_received',
                conversation_id: lastLog.conversation_id,
                patient_id: patientId,
                patient_name: patientName,
                request_id: requestId
            })
        });
    }
  } catch (e) {
    console.error("Notification error:", e.message);
  }
}
