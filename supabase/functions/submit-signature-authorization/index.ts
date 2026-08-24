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

    const { token, signatureData, accepted } = await req.json()

    if (!token || !signatureData || !accepted) {
      throw new Error("Missing required fields")
    }

    // 1. Verify token
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('patient_signature_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (tokenError || !tokenData || tokenData.used_at || new Date(tokenData.expires_at) < new Date()) {
      throw new Error("Invalid or expired token")
    }

    // 2. Upload signature to storage
    const fileName = `${tokenData.patient_id}/${Date.now()}.png`
    const base64Data = signatureData.split(',')[1]
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

    const { error: uploadError } = await supabaseClient.storage
      .from('patient-signatures')
      .upload(fileName, binaryData, {
        contentType: 'image/png',
        upsert: true
      })

    if (uploadError) throw uploadError

    // 3. Update patient record
    const { error: patientError } = await supabaseClient
      .from('patients')
      .update({
        signature_url: fileName,
        signature_accepted: true,
        signature_accepted_at: new Date().toISOString()
      })
      .eq('id', tokenData.patient_id)

    if (patientError) throw patientError

    // 4. Mark token as used
    await supabaseClient
      .from('patient_signature_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)

    return new Response(JSON.stringify({ success: true }), {
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
