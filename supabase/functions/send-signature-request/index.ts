import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { associadoId, clinicId, createOnly } = await req.json()

    if (!associadoId || !clinicId) {
      throw new Error("associadoId and clinicId are required")
    }

    // Generate a random token
    const token = crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    // Store token in public.patient_signature_tokens (or similar table if exists, otherwise mock)
    // For this implementation, we'll return the token. 
    // Usually, we'd upsert this into a database table.
    
    // Attempt to record the intent
    await supabaseClient
      .from('patient_signature_tokens')
      .insert({
        token,
        patient_id: associadoId,
        clinic_id: clinicId,
        expires_at: expiresAt.toISOString()
      })

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
