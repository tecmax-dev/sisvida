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

    const norm = (v: unknown) => String(v ?? '').replace(/\D/g, '');

    const auth = await getAuthContext(req);
    if (auth) {
      if (auth.isStaff) {
        authorized = true;
      } else if (auth.patientId && auth.patientId === patientId) {
        authorized = true;
      } else if (auth.patientId) {
        // O app pode carregar um registro duplicado com o mesmo CPF do titular logado
        const { data: sessionPatient } = await supabase
          .from('patients').select('cpf').eq('id', auth.patientId).maybeSingle();
        const { data: targetPatient } = await supabase
          .from('patients').select('cpf').eq('id', patientId).maybeSingle();
        if (
          norm(sessionPatient?.cpf).length === 11 &&
          norm(sessionPatient?.cpf) === norm(targetPatient?.cpf)
        ) {
          authorized = true;
        }
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

    const { data: patient } = await supabase.from('patients').select('name, phone, employer_name, employer_cnpj').eq('id', patientId).single();

    if (patient) {
      edgeNotify(supabase, patientId, clinicId, request.id, patient.name, patient.phone);
    }

    // ---- Validação automática (mesma ferramenta: verify-payslip-document) ----
    let autoApproved = false;
    let autoReason: string | null = null;
    try {
      const auto = await autoValidate(file, patient);
      autoApproved = auto.ok;
      autoReason = auto.reason;
      if (auto.ok) {
        // Validade: último dia do mês seguinte à competência do contracheque (ex.: 08/2026 → 30/09/2026)
        const last = new Date(Date.UTC(auto.year, auto.month + 1, 0));
        const expDate = last.toISOString().slice(0, 10);
        const expTs = `${expDate}T12:00:00-03:00`;
        await supabase.from('payslip_requests').update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          notes: 'Aprovado automaticamente pela validação de contracheque.',
        }).eq('id', request.id);
        await supabase.from('patient_cards').update({ expires_at: expTs }).eq('id', cardId);
        await supabase.from('patient_dependents').update({ card_expires_at: expTs }).eq('patient_id', patientId).eq('is_active', true);
      } else {
        await supabase.from('payslip_requests').update({
          notes: `Validação automática não aprovou: ${auto.reason}. Aguardando validação manual.`,
        }).eq('id', request.id);
      }
    } catch (e: any) {
      console.error('[mobile-payslip-upload] auto-validate error:', e?.message);
      autoReason = 'Falha na análise automática';
    }

    return json({ success: true, requestId: request.id, auto_approved: autoApproved, auto_reason: autoReason, build_id: BUILD_ID });
  } catch (e: any) {
    console.error(`[mobile-payslip-upload] ERROR: ${e.message}`, e);
    return json({ error: 'UPLOAD_FAILED', build_id: BUILD_ID }, 500);
  }
});

const MAX_PERIOD_DAYS = 30;

async function autoValidate(file: File, patient: any): Promise<{ ok: boolean; reason: string; month: number; year: number }> {
  const type = file.type || '';
  const isPdf = type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  if (!type.startsWith('image/') && !isPdf) return { month: 0, year: 0, ok: false, reason: 'Formato não suportado para análise automática' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/verify-payslip-document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
    body: JSON.stringify({
      file_base64: btoa(bin), file_name: file.name, file_type: isPdf ? 'application/pdf' : type,
      member_name: patient?.name || '', employer_name: patient?.employer_name || '', employer_cnpj: patient?.employer_cnpj || '',
    }),
  });
  const d: any = await res.json().catch(() => ({}));
  if (d?.error) return { month: 0, year: 0, ok: false, reason: 'Falha na análise automática' };
  if (!d?.is_payslip) return { month: 0, year: 0, ok: false, reason: 'Documento não identificado como contracheque' };
  const it = d.found_items || {};
  if (!(it.mensalidade_sindical || it.taxa_negocial || it.taxa_assistencial)) return { month: 0, year: 0, ok: false, reason: 'Desconto sindical não encontrado' };
  if (d.name_match !== true) return { month: 0, year: 0, ok: false, reason: 'Nome do trabalhador diverge do cadastro' };
  if (d.employer_match !== true) return { month: 0, year: 0, ok: false, reason: 'Nome da empresa diverge do cadastro' };

  // Período de pagamento: no máximo 30 dias
  let ref: Date | null = null;
  let month = 0, year = 0;
  const pay = String(d.data_pagamento || '');
  const m = String(d.competencia || '').match(/^(\d{1,2})\/(\d{4})$/);
  if (m) { month = Number(m[1]); year = Number(m[2]); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(pay)) {
    ref = new Date(`${pay}T12:00:00-03:00`);
    if (!month) { year = Number(pay.slice(0, 4)); month = Number(pay.slice(5, 7)); }
  } else if (m) ref = new Date(year, month, 0, 12); // último dia da competência
  if (!month || month > 12) return { month: 0, year: 0, ok: false, reason: 'Competência não identificada' };
  if (!ref || isNaN(ref.getTime())) return { month: 0, year: 0, ok: false, reason: 'Período de pagamento não identificado' };
  const days = (Date.now() - ref.getTime()) / 86400000;
  if (days > MAX_PERIOD_DAYS) return { month: 0, year: 0, ok: false, reason: `Período de pagamento além de ${MAX_PERIOD_DAYS} dias` };
  return { ok: true, reason: 'Aprovado', month, year };
}

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
