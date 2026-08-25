import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { requireStaff, authErrorResponse } from "../_shared/authGuard.ts"

const BUILD_ID = "CARD-LINK-TOKEN-RESTORE-2026-08-11-01";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const genToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // ---------- GENERATE ----------
    if (action === 'generate') {
      const { patientId, cpf, ttlMinutes } = body;
      let patient: any = null;

      if (patientId) {
        const { data } = await admin.from('patients').select('id, name, clinic_id').eq('id', patientId).maybeSingle();
        patient = data;
      } else if (cpf) {
        const digits = String(cpf).replace(/\D/g, '');
        const { data } = await admin
          .from('patients')
          .select('id, name, clinic_id, cpf')
          .or(`cpf.eq.${digits},cpf.eq.${digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')}`)
          .limit(1);
        patient = data?.[0] ?? null;
      }

      if (!patient) return json({ success: false, error: 'PATIENT_NOT_FOUND', build: BUILD_ID }, 404);

      const token = genToken();
      const ttl = Number(ttlMinutes) > 0 ? Number(ttlMinutes) : 60;
      const expiresAt = new Date(Date.now() + ttl * 60 * 1000).toISOString();

      const { error } = await admin.from('card_update_tokens').insert({
        token,
        patient_id: patient.id,
        clinic_id: patient.clinic_id,
        expires_at: expiresAt,
      });
      if (error) return json({ success: false, error: 'TOKEN_INSERT_FAILED', details: error.message }, 500);

      return json({
        success: true,
        token,
        expires_at: expiresAt,
        url: `https://sindexa.com.br/atualizar-carteirinha?t=${token}`,
        build: BUILD_ID,
      });
    }

    // ---------- VALIDATE (read-only, never consumes) ----------
    if (action === 'validate') {
      const token = body?.token;
      if (!token) return json({ success: false, error: 'TOKEN_REQUIRED', build: BUILD_ID }, 400);

      const { data: rec } = await admin
        .from('card_update_tokens')
        .select('id, patient_id, clinic_id, expires_at, used_at, revoked_at')
        .eq('token', token)
        .maybeSingle();

      if (!rec) return json({ success: false, error: 'TOKEN_INVALID', build: BUILD_ID }, 200);
      if (rec.revoked_at) return json({ success: false, error: 'TOKEN_REVOKED', build: BUILD_ID }, 200);
      if (new Date(rec.expires_at).getTime() <= Date.now())
        return json({ success: false, error: 'TOKEN_EXPIRED', build: BUILD_ID }, 200);

      const { data: patient } = await admin
        .from('patients').select('id, name, clinic_id').eq('id', rec.patient_id).maybeSingle();
      if (!patient) return json({ success: false, error: 'PATIENT_NOT_FOUND', build: BUILD_ID }, 200);

      // Cards may live on a duplicate patient record sharing the same CPF
      const { data: self } = await admin.from('patients').select('cpf').eq('id', rec.patient_id).maybeSingle();
      const cpfDigits = String(self?.cpf ?? '').replace(/\D/g, '');
      let patientIds = [rec.patient_id];
      if (cpfDigits.length === 11) {
        const masked = cpfDigits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
        const { data: dup } = await admin
          .from('patients')
          .select('id')
          .or(`cpf.eq.${cpfDigits},cpf.eq.${masked}`);
        patientIds = Array.from(new Set([...patientIds, ...((dup ?? []).map((d: any) => d.id))]));
      }

      const { data: cards } = await admin
        .from('patient_cards')
        .select('id, card_number, expires_at, is_active, patient_id')
        .in('patient_id', patientIds)
        .order('expires_at', { ascending: false })
        .limit(1);
      const card = cards?.[0] ?? null;

      const { data: reqs } = await admin
        .from('payslip_requests')
        .select('id, status, requested_at, received_at')
        .in('patient_id', patientIds)
        .order('requested_at', { ascending: false })
        .limit(1);
      const pending = reqs?.[0] ?? null;

      const updateRequired = !card || !card.is_active ||
        (card.expires_at ? new Date(card.expires_at).getTime() <= Date.now() : true);

      return json({
        success: true,
        patient: { id: patient.id, name: patient.name, clinic_id: patient.clinic_id },
        card,
        pending_request: pending,
        update_required: updateRequired,
        build: BUILD_ID,
      });
    }

    // ---------- CONSUME (after successful upload) ----------
    if (action === 'consume') {
      const token = body?.token;
      if (!token) return json({ success: false, error: 'TOKEN_REQUIRED' }, 400);
      await admin.from('card_update_tokens').update({ used_at: new Date().toISOString() }).eq('token', token).is('used_at', null);
      return json({ success: true, build: BUILD_ID });
    }

    // ---------- RUNTIME AUDIT (kept) ----------
    if (action === 'runtime-audit') {
      const { data: secret } = await admin.rpc('get_meta_vault_secret', { _secret_name: 'META_WHATSAPP_TOKEN_V2' });
      const token = secret ? String(secret) : Deno.env.get('META_WHATSAPP_TOKEN_V2');
      const phoneId = "1213495528515111";
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      return json({ status: "AUDIT_COMPLETE", runtime_phone_id: phoneId, graph_http: res.status, graph_id: data.id, token_source: secret ? "vault" : "env", build: BUILD_ID });
    }

    return json({ success: false, error: "UNKNOWN_ACTION", action, build: BUILD_ID }, 400);
  } catch (e: any) {
    return json({ success: false, error: 'INTERNAL_ERROR', details: e.message, build: BUILD_ID }, 500);
  }
});
