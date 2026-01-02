import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ID da clínica Sindicato Comerciários
const SINDICATO_COMERCIARIOS_CLINIC_ID = '89e7585e-7bce-4e58-91fa-c37080d1170d'

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
  // Remove tudo que não é dígito
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return null
  return digits
}

function formatPhone(phone: string | undefined): string {
  if (!phone) return ''
  // Remove tudo que não é dígito
  const digits = phone.replace(/\D/g, '')
  // Retorna com formato padrão se tiver 10 ou 11 dígitos
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
  
  // Tenta parsear diferentes formatos
  // Formato: DD/MM/YYYY ou YYYY-MM-DD
  if (dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/')
    if (day && month && year) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
  }
  
  // Já está no formato ISO
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
async function generateCardNumber(supabase: any, clinicId: string): Promise<string> {
  const currentYear = new Date().getFullYear().toString()
  
  try {
    const { data, error } = await supabase.rpc('generate_card_number', { p_clinic_id: clinicId })
    
    if (error || !data) {
      // Fallback: gera manualmente
      const timestamp = Date.now().toString().slice(-5)
      return `C${currentYear}${timestamp}`
    }
    
    return data
  } catch {
    // Fallback: gera manualmente
    const timestamp = Date.now().toString().slice(-5)
    return `C${currentYear}${timestamp}`
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse o body do request
    const body = await req.json()
    
    console.log('🔔 SindSystem Webhook recebido:', JSON.stringify(body, null, 2))

    // O payload pode vir como objeto único ou array
    const socios: SindSystemSocio[] = Array.isArray(body) ? body : [body]
    
    const results: { success: boolean; cpf: string | null; name: string | null; action: string; error?: string }[] = []

    for (const socio of socios) {
      try {
        const cpf = formatCPF(socio.NRCPF)
        const name = socio.NMSOCIO?.trim()
        
        if (!name) {
          results.push({ success: false, cpf, name: null, action: 'skipped', error: 'Nome não informado' })
          continue
        }

        // Define o telefone - prioriza celular
        const phone = formatPhone(socio.NRCELULAR) || formatPhone(socio.NRFONE) || ''
        
        // Dados do paciente a serem inseridos/atualizados
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
          notes: `Importado do SindSystem - Sócio #${socio.NRSOCIO || 'N/A'}`,
        }

        let patientId: string | null = null
        let action = 'created'

        // Tenta encontrar paciente existente pelo CPF
        if (cpf) {
          const { data: existingPatient } = await supabase
            .from('patients')
            .select('id')
            .eq('clinic_id', SINDICATO_COMERCIARIOS_CLINIC_ID)
            .eq('cpf', cpf)
            .maybeSingle()

          if (existingPatient) {
            // Atualiza paciente existente
            const { error: updateError } = await supabase
              .from('patients')
              .update({
                ...patientData,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingPatient.id)

            if (updateError) {
              console.error('Erro ao atualizar paciente:', updateError)
              results.push({ success: false, cpf, name, action: 'update_failed', error: updateError.message })
              continue
            }

            patientId = existingPatient.id
            action = 'updated'
            console.log(`✅ Paciente atualizado: ${name} (CPF: ${cpf})`)
          }
        }

        // Se não encontrou pelo CPF, tenta pelo nome normalizado
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
              console.error('Erro ao atualizar paciente por nome:', updateError)
              results.push({ success: false, cpf, name, action: 'update_failed', error: updateError.message })
              continue
            }

            patientId = existingByName.id
            action = 'updated'
            console.log(`✅ Paciente atualizado por nome: ${name}`)
          }
        }

        // Se ainda não encontrou, cria novo paciente
        if (!patientId) {
          const { data: newPatient, error: insertError } = await supabase
            .from('patients')
            .insert(patientData)
            .select('id')
            .single()

          if (insertError) {
            console.error('Erro ao criar paciente:', insertError)
            results.push({ success: false, cpf, name, action: 'insert_failed', error: insertError.message })
            continue
          }

          patientId = newPatient.id
          action = 'created'
          console.log(`✅ Novo paciente criado: ${name} (CPF: ${cpf})`)

          // Gera carteirinha para novo paciente (15 dias de validade)
          try {
            const cardNumber = await generateCardNumber(supabase, SINDICATO_COMERCIARIOS_CLINIC_ID)
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

            console.log(`💳 Carteirinha gerada: ${cardNumber}`)
          } catch (cardError) {
            console.error('Erro ao gerar carteirinha:', cardError)
            // Não falha a operação principal
          }
        }

        results.push({ success: true, cpf, name, action })
      } catch (socioError) {
        console.error('Erro ao processar sócio:', socioError)
        results.push({ 
          success: false, 
          cpf: socio.NRCPF || null, 
          name: socio.NMSOCIO || null, 
          action: 'error', 
          error: socioError instanceof Error ? socioError.message : 'Erro desconhecido' 
        })
      }
    }

    const summary = {
      total: results.length,
      created: results.filter(r => r.action === 'created').length,
      updated: results.filter(r => r.action === 'updated').length,
      failed: results.filter(r => !r.success).length,
      results,
    }

    console.log('📊 Resumo do processamento:', JSON.stringify(summary, null, 2))

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('❌ Erro no webhook SindSystem:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao processar webhook', 
        details: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
