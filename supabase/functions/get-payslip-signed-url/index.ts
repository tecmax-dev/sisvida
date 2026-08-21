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
      return new Response(JSON.stringify({ error: 'O caminho do arquivo é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`[get-payslip-signed-url] Solicitando URL assinada para: ${path}`)

    // 1. Tentar bucket 'contra-cheques'
    let { data, error } = await supabaseAdmin.storage
      .from('contra-cheques')
      .createSignedUrl(path, 3600)

    // 2. Se não encontrar, tentar bucket 'payslips'
    if (error || !data?.signedUrl) {
      console.log(`[get-payslip-signed-url] Não encontrado em 'contra-cheques', tentando 'payslips'.`)
      const { data: data2, error: error2 } = await supabaseAdmin.storage
        .from('payslips')
        .createSignedUrl(path, 3600)
      
      data = data2
      error = error2
    }

    // 3. Se ainda não encontrar, tentar bucket 'patient-attachments' (backup histórico)
    if (error || !data?.signedUrl) {
      console.log(`[get-payslip-signed-url] Não encontrado em 'payslips', tentando 'patient-attachments'.`)
      const { data: data3, error: error3 } = await supabaseAdmin.storage
        .from('patient-attachments')
        .createSignedUrl(path, 3600)
      
      data = data3
      error = error3
    }

    if (error || !data?.signedUrl) {
      console.error('[get-payslip-signed-url] Erro final ao gerar URL assinada:', error)
      return new Response(JSON.stringify({ 
        error: error?.message || 'Arquivo não encontrado nos buckets do sistema',
        details: 'Caminho verificado: ' + path
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[get-payslip-signed-url] URL gerada com sucesso para: ${path}`)
    return new Response(JSON.stringify({ signedUrl: data.signedUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[get-payslip-signed-url] Erro inesperado:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
