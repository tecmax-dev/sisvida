import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Validar CPF com dígitos verificadores
function validateCpf(cpf: string): boolean {
  const cleanCpf = cpf.replace(/\D/g, '')
  if (cleanCpf.length !== 11) return false
  if (/^(\d)\1+$/.test(cleanCpf)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cleanCpf[i]) * (10 - i)
  let remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cleanCpf[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cleanCpf[i]) * (11 - i)
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  return remainder === parseInt(cleanCpf[10])
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const sindicatoId = body?.sindicatoId
    const cpf = body?.cpf

    if (!isUuid(sindicatoId)) {
      return new Response(JSON.stringify({ error: 'sindicatoId inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cleanCpf = typeof cpf === 'string' ? cpf.replace(/\D/g, '') : ''
    if (!cleanCpf || cleanCpf.length !== 11) {
      return new Response(JSON.stringify({ error: 'CPF deve ter 11 dígitos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!validateCpf(cleanCpf)) {
      return new Response(JSON.stringify({ error: 'CPF inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Client com service role (bypassa permissões)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const formattedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')

    const { data, error } = await supabase
      .from('sindical_associados')
      .select('id, status')
      .eq('sindicato_id', sindicatoId)
      // IMPORTANT: Only treat as "existing application" when it's still pending approval
      .eq('status', 'pendente')
      .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf}`)
      .maybeSingle()

    if (error) {
      console.error('Database error:', error)
      return new Response(JSON.stringify({ error: 'Erro ao buscar solicitação' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        exists: !!data,
        associado: data ? { id: data.id, status: data.status } : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Error processing request:', err)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
