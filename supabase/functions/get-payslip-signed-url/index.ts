import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { requireUser, authErrorResponse } from "../_shared/authGuard.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  let auth
  try {
    auth = await requireUser(req)
  } catch (authErr) {
    const denied = authErrorResponse(authErr, corsHeaders)
    if (denied) return denied
    throw authErr
  }

  try {
    const { path } = await req.json()
    if (!path || typeof path !== 'string') {
      return jsonResponse({ error: 'O caminho do arquivo é obrigatório' }, 400)
    }
    if (path.includes('..')) {
      return jsonResponse({ error: 'Caminho inválido' }, 400)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ---- Authorization: staff of the owning clinic, or the patient who owns the file ----
    const { data: request } = await supabaseAdmin
      .from('payslip_requests')
      .select('patient_id, clinic_id')
      .eq('attachment_path', path)
      .maybeSingle()

    const { data: attachment } = await supabaseAdmin
      .from('patient_attachments')
      .select('patient_id, clinic_id')
      .eq('file_path', path)
      .maybeSingle()

    const owner = request ?? attachment
    // Storage paths follow `${clinicId}/${patientId}/...`
    const segments = path.split('/')
    const pathClinicId = segments[0] ?? null
    const pathPatientId = segments[1] ?? null

    const ownerPatientId = owner?.patient_id ?? pathPatientId
    const ownerClinicId = owner?.clinic_id ?? pathClinicId

    let allowed = false
    if (auth.isSuperAdmin) {
      allowed = true
    } else if (auth.isStaff && ownerClinicId) {
      const { data: access } = await supabaseAdmin.rpc('has_clinic_access', {
        _user_id: auth.userId,
        _clinic_id: ownerClinicId,
      })
      allowed = access === true
    } else if (auth.patientId && ownerPatientId) {
      allowed = auth.patientId === ownerPatientId
    }

    if (!allowed) {
      return jsonResponse({ error: 'Acesso negado a este documento' }, 403)
    }

    const buckets = ['contra-cheques', 'payslips', 'patient-attachments']
    for (const bucket of buckets) {
      const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 3600)
      if (!error && data?.signedUrl) {
        return jsonResponse({ signedUrl: data.signedUrl })
      }
    }

    return jsonResponse({ error: 'Arquivo não encontrado' }, 404)
  } catch (error) {
    console.error('[get-payslip-signed-url] Erro inesperado:', error.message)
    return jsonResponse({ error: 'Não foi possível gerar o link do documento' }, 500)
  }
})
