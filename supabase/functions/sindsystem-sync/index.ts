import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ID da clínica Sindicato Comerciários
const SINDICATO_COMERCIARIOS_CLINIC_ID = '89e7585e-7bce-4e58-91fa-c37080d1170d'

// Base URL da API SindSystem (conforme documentação)
const SINDSYSTEM_BASE_URL = 'https://secmi.sindsystem.com.br/api'

interface SindSystemSocio {
  NRSOCIO?: string | number
  NMSOCIO?: string
  NRCPF?: string
  DTNASC?: string
  NRFONE?: string
  NRCELULAR?: string
  DSEMAIL?: string
  DSLOGRADOURO?: string
  NRLOGRADOURO?: string
  DSBAIRRO?: string
  NMCIDADE?: string
  CDUF?: string
  NRCEP?: string
  NMEMPRESA?: string
  NRCNPJEMPRESA?: string
  NRRG?: string
  CDSEXO?: string
  NMCARGO?: string
  DTSTATUS?: string
  CDSTATUS?: string
  [key: string]: unknown
}

function formatCPF(cpf: string | undefined): string | null {
  if (!cpf) return null
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return null
  return digits
}

function formatPhone(phone: string | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  return digits
}

function formatCNPJ(cnpj: string | undefined): string | null {
  if (!cnpj) return null
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return null
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function formatDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null
  
  if (dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/')
    if (day && month && year) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
  }
  
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return dateStr.split('T')[0]
  }
  
  return null
}

function mapGender(code: string | undefined): string | null {
  if (!code) return null
  const upper = code.toUpperCase()
  if (upper === 'M') return 'masculino'
  if (upper === 'F') return 'feminino'
  return null
}

// deno-lint-ignore no-explicit-any
async function generateCardNumber(supabase: any, clinicId: string, patientId: string): Promise<string> {
  const currentYear = new Date().getFullYear().toString()
  
  try {
    const { data, error } = await supabase.rpc('generate_card_number', { 
      p_clinic_id: clinicId,
      p_patient_id: patientId 
    })
    
    if (error || !data) {
      const timestamp = Date.now().toString().slice(-5)
      return `C${currentYear}${timestamp}`
    }
    
    return data
  } catch {
    const timestamp = Date.now().toString().slice(-5)
    return `C${currentYear}${timestamp}`
  }
}

async function fetchSociosFromSindSystem(token: string): Promise<SindSystemSocio[]> {
  // Lista de endpoints para tentar (baseado na documentação)
  const endpoints = [
    `${SINDSYSTEM_BASE_URL}/${token}/associado/lista`,
    `${SINDSYSTEM_BASE_URL}/${token}/socio/lista`,
    `${SINDSYSTEM_BASE_URL}/${token}/socios`,
    `${SINDSYSTEM_BASE_URL}/${token}/associados`,
  ]
  
  for (const url of endpoints) {
    console.log(`📡 Tentando endpoint: ${url.replace(token, token.slice(0, 8) + '***')}`)
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('📦 Resposta da API:', JSON.stringify(data).slice(0, 500))
        
        // A API pode retornar um objeto com array ou diretamente um array
        if (Array.isArray(data)) {
          console.log(`✅ Endpoint funcionou: ${url.replace(token, '***')}`)
          return data
        }
        
        // Tenta diferentes formatos de resposta
        const possibleArrays = ['socios', 'data', 'resultado', 'associados', 'lista', 'items', 'records']
        for (const key of possibleArrays) {
          if (data[key] && Array.isArray(data[key])) {
            console.log(`✅ Endpoint funcionou com key "${key}": ${url.replace(token, '***')}`)
            return data[key]
          }
        }
        
        // Se tem algum dado, retorna como array de um elemento
        if (Object.keys(data).length > 0 && !data.message && !data.error) {
          console.log('⚠️ Resposta não é array, tentando próximo endpoint...')
        }
      } else {
        console.log(`❌ Endpoint retornou ${response.status}`)
      }
    } catch (error) {
      console.log(`❌ Erro no endpoint: ${error}`)
    }
  }
  
  throw new Error('Nenhum endpoint de listagem de sócios funcionou. Verifique a documentação da API.')
}

// deno-lint-ignore no-explicit-any
async function processSocio(supabase: any, socio: SindSystemSocio): Promise<{ success: boolean; cpf: string | null; name: string | null; action: string; error?: string }> {
  try {
    const cpf = formatCPF(socio.NRCPF)
    const name = socio.NMSOCIO?.trim()
    
    if (!name) {
      return { success: false, cpf, name: null, action: 'skipped', error: 'Nome não informado' }
    }

    const phone = formatPhone(socio.NRCELULAR) || formatPhone(socio.NRFONE) || ''
    
    const patientData = {
      clinic_id: SINDICATO_COMERCIARIOS_CLINIC_ID,
      name: name,
      cpf: cpf,
      phone: phone,
      email: socio.DSEMAIL || null,
      birth_date: formatDate(socio.DTNASC),
      rg: socio.NRRG || null,
      gender: mapGender(socio.CDSEXO),
      street: socio.DSLOGRADOURO || null,
      street_number: socio.NRLOGRADOURO || null,
      neighborhood: socio.DSBAIRRO || null,
      city: socio.NMCIDADE || null,
      state: socio.CDUF || null,
      cep: socio.NRCEP?.replace(/\D/g, '') || null,
      employer_name: socio.NMEMPRESA || null,
      employer_cnpj: formatCNPJ(socio.NRCNPJEMPRESA),
      profession: socio.NMCARGO || null,
      is_union_member: true,
      notes: `Importado do SindSystem - Sócio #${socio.NRSOCIO || 'N/A'}`,
    }

    let patientId: string | null = null
    let action = 'created'

    // Tenta encontrar paciente existente pelo CPF - support both formatted and unformatted
    if (cpf) {
      const formattedCpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      const { data: existingPatient } = await supabase
        .from('patients')
        .select('id')
        .eq('clinic_id', SINDICATO_COMERCIARIOS_CLINIC_ID)
        .or(`cpf.eq.${cpf},cpf.eq.${formattedCpf}`)
        .maybeSingle()

      if (existingPatient) {
        const { error: updateError } = await supabase
          .from('patients')
          .update({
            ...patientData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPatient.id)

        if (updateError) {
          return { success: false, cpf, name, action: 'update_failed', error: updateError.message }
        }

        patientId = existingPatient.id
        action = 'updated'
      }
    }

    // Se não encontrou pelo CPF, tenta pelo nome
    if (!patientId && name) {
      const normalizedName = name.toLowerCase().trim()
      
      const { data: existingByName } = await supabase
        .from('patients')
        .select('id')
        .eq('clinic_id', SINDICATO_COMERCIARIOS_CLINIC_ID)
        .ilike('name', normalizedName)
        .maybeSingle()

      if (existingByName) {
        const { error: updateError } = await supabase
          .from('patients')
          .update({
            ...patientData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingByName.id)

        if (updateError) {
          return { success: false, cpf, name, action: 'update_failed', error: updateError.message }
        }

        patientId = existingByName.id
        action = 'updated'
      }
    }

    // Cria novo paciente
    if (!patientId) {
      const { data: newPatient, error: insertError } = await supabase
        .from('patients')
        .insert(patientData)
        .select('id')
        .single()

      if (insertError) {
        return { success: false, cpf, name, action: 'insert_failed', error: insertError.message }
      }

      patientId = newPatient.id
      action = 'created'

      // Gera carteirinha para novo paciente
      try {
        const cardNumber = await generateCardNumber(supabase, SINDICATO_COMERCIARIOS_CLINIC_ID, patientId!)
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 15)

        await supabase
          .from('patient_cards')
          .insert({
            clinic_id: SINDICATO_COMERCIARIOS_CLINIC_ID,
            patient_id: patientId,
            card_number: cardNumber,
            expires_at: expiresAt.toISOString(),
            is_active: true,
            qr_code_token: crypto.randomUUID(),
          })
      } catch (cardError) {
        console.error('Erro ao gerar carteirinha:', cardError)
      }
    }

    return { success: true, cpf, name, action }
  } catch (error) {
    return { 
      success: false, 
      cpf: socio.NRCPF || null, 
      name: socio.NMSOCIO || null, 
      action: 'error', 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sindSystemToken = Deno.env.get('SINDSYSTEM_API_TOKEN')
    
    if (!sindSystemToken) {
      throw new Error('Token da API SindSystem não configurado (SINDSYSTEM_API_TOKEN)')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔄 Iniciando sincronização com SindSystem...')
    
    // Busca sócios da API SindSystem
    const socios = await fetchSociosFromSindSystem(sindSystemToken)
    
    console.log(`📋 ${socios.length} sócios encontrados na API`)
    
    const results: { success: boolean; cpf: string | null; name: string | null; action: string; error?: string }[] = []

    // Processa cada sócio
    for (const socio of socios) {
      const result = await processSocio(supabase, socio)
      results.push(result)
      
      if (result.success) {
        console.log(`✅ ${result.action}: ${result.name}`)
      } else {
        console.log(`❌ ${result.action}: ${result.name || 'sem nome'} - ${result.error}`)
      }
    }

    const summary = {
      total: results.length,
      created: results.filter(r => r.action === 'created').length,
      updated: results.filter(r => r.action === 'updated').length,
      failed: results.filter(r => !r.success).length,
      timestamp: new Date().toISOString(),
    }

    console.log('📊 Resumo da sincronização:', JSON.stringify(summary, null, 2))

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('❌ Erro na sincronização SindSystem:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erro na sincronização', 
        details: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
