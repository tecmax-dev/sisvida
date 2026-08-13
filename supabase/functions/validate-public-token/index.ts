import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { token, purpose } = await req.json()

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (purpose !== 'whatsapp_consent') {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid purpose' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // A página pública usa tokens da tabela signature_request_tokens para fluxos seguros sem login
    const { data: tokenData, error: tokenError } = await supabase
      .from('signature_request_tokens')
      .select('patient_id, clinic_id, expires_at, used_at')
      .eq('token', token)
      .single()

    if (tokenError || !tokenData) {
      console.error('Token validation error:', tokenError)
      return new Response(
        JSON.stringify({ success: false, error: 'Link de acesso inválido ou expirado.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validação de expiração
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Link expirado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Busca dados mínimos do paciente para exibição
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, name, phone, clinic_id')
      .eq('id', tokenData.patient_id)
      .single()

    if (patientError || !patient) {
      console.error('Patient lookup error:', patientError)
      return new Response(
        JSON.stringify({ success: false, error: 'Associado não localizado.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Retorna sucesso com dados sanitizados
    return new Response(
      JSON.stringify({ 
        success: true, 
        patient: {
          id: patient.id,
          name: patient.name,
          phone: patient.phone,
          clinic_id: patient.clinic_id
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})