import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { path } = await req.json()
    if (!path) {
      return new Response(JSON.stringify({ error: 'Path is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`[get-payslip-signed-url] Requesting signed URL for path: ${path}`)

    // Try 'contra-cheques' bucket first
    let { data, error } = await supabaseAdmin.storage
      .from('contra-cheques')
      .createSignedUrl(path, 3600)

    // If not found or error, try 'payslips' bucket
    if (error || !data?.signedUrl) {
      console.log(`[get-payslip-signed-url] Not found in 'contra-cheques', trying 'payslips' bucket. Error was: ${error?.message}`)
      const { data: data2, error: error2 } = await supabaseAdmin.storage
        .from('payslips')
        .createSignedUrl(path, 3600)
      
      data = data2
      error = error2
    }

    if (error) {
      console.error('[get-payslip-signed-url] Error generating signed URL:', error)
      return new Response(JSON.stringify({ 
        error: error.message,
        details: 'Verifique se o arquivo existe em "contra-cheques" ou "payslips" e se a Edge Function tem permissão de service_role.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ signedUrl: data.signedUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[get-payslip-signed-url] Unexpected error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
