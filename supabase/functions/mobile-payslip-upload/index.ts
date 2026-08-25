import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { getAuthContext } from "../_shared/authGuard.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUILD_ID = "SECURE-UPLOAD-2026-08-25-01";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
    const cardToken = (formData.get('token') as string | null) ?? null;

    if (!file || !patientId || !clinicId || !cardId) {
      return json({ error: 'MISSING_FIELDS' }, 400);
    }

    // ---- Authorization: patient session OR a valid single-use card-update token ----
    let authorized = false;

    const auth = await getAuthContext(req);
    if (auth) {
      if (auth.isStaff) {
        authorized = true;
      } else if (auth.patientId && auth.patientId === patientId) {
        authorized = true;
      }
    }

    if (!authorized && cardToken) {
      const { data: tokenRow } = await supabase
        .from('card_update_tokens')
        .select('patient_id, clinic_id, expires_at, revoked_at')
        .eq('token', cardToken)
        .maybeSingle();

      if (
        tokenRow &&
        !tokenRow.revoked_at &&
        new Date(tokenRow.expires_at).getTime() > Date.now()
      ) {
        // Token may point to a duplicate record sharing the same CPF
        const { data: tokenPatient } = await supabase
          .from('patients').select('cpf').eq('id', tokenRow.patient_id).maybeSingle();
        const { data: targetPatient } = await supabase
          .from('patients').select('cpf, clinic_id').eq('id', patientId).maybeSingle();

        const norm = (v: unknown) => String(v ?? '').replace(/\D/g, '');
        if (
          tokenRow.patient_id === patientId ||
          (norm(tokenPatient?.cpf).length === 11 && norm(tokenPatient?.cpf) === norm(targetPatient?.cpf))
        ) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return json({ error: 'UNAUTHORIZED' }, 401);
    }

    // ---- Integrity: the card must belong to the informed patient and clinic ----
    const { data: card } = await supabase
      .from('patient_cards')
      .select('id, patient_id, clinic_id')
      .eq('id', cardId)
      .maybeSingle();

    if (!card) return json({ error: 'CARD_NOT_FOUND' }, 404);
    if (card.patient_id !== patientId || card.clinic_id !== clinicId) {
      return json({ error: 'CARD_MISMATCH' }, 403);
    }

    const fileExt = (file.name.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '');
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

    if (patient) {
      edgeNotify(supabase, patientId, clinicId, request.id, patient.name, patient.phone);
    }

    return json({ success: true, requestId: request.id, build_id: BUILD_ID });
  } catch (e: any) {
    console.error(`[mobile-payslip-upload] ERROR: ${e.message}`, e);
    return json({ error: 'UPLOAD_FAILED', build_id: BUILD_ID }, 500);
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
