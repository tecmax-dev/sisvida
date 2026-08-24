import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { token } = await req.json()

    if (!token) throw new Error("Token is required")

    // Fetch token data
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('patient_signature_tokens')
      .select(`
        id,
        patient_id,
        clinic_id,
        expires_at,
        used_at,
        patient:patients!patient_signature_tokens_patient_id_fkey (
          name,
          cpf,
          employer_name
        )
      `)
      .eq('token', token)
      .single()

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ success: false, error: "Link inválido ou expirado" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (tokenData.used_at) {
      return new Response(JSON.stringify({ success: false, error: "Este link já foi utilizado" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, error: "Este link expirou" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Fetch union entity info
    const { data: unionEntity } = await supabaseClient
      .from('union_entities')
      .select('razao_social, logo_url')
      .eq('clinic_id', tokenData.clinic_id)
      .maybeSingle()

    return new Response(JSON.stringify({ 
      success: true, 
      tokenData: {
        ...tokenData,
        union_entity: unionEntity
      } 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
