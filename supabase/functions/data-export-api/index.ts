import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate API Key
    const apiKey = req.headers.get('x-api-key') || req.headers.get('X-API-Key')
    const expectedKey = Deno.env.get('SOURCE_API_KEY')
    
    console.log('[data-export-api] API Key present:', !!apiKey, 'Expected key configured:', !!expectedKey)
    
    if (!apiKey || apiKey !== expectedKey) {
      console.error('[data-export-api] Unauthorized - invalid API key')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const endpoint = pathParts[pathParts.length - 1] || ''
    
    // Pagination
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '1000'), 10000)
    const offset = parseInt(url.searchParams.get('offset') || String((page - 1) * limit))
    
    // Date filters
    const startDate = url.searchParams.get('start_date')
    const endDate = url.searchParams.get('end_date')

    console.log(`[data-export-api] Endpoint: ${endpoint}, Limit: ${limit}, Offset: ${offset}`)

    const success = (data: any, total: number) => new Response(
      JSON.stringify({ data, total }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

    switch (endpoint) {
      case 'health': {
        return new Response(
          JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'clinics': {
        const { data, error, count } = await supabase
          .from('clinics').select('*', { count: 'exact' }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'procedures': {
        const { data, error, count } = await supabase
          .from('procedures').select('*', { count: 'exact' }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'insurance_plans': {
        const { data, error, count } = await supabase
          .from('insurance_plans').select('*', { count: 'exact' }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'specialties': {
        const { data, error, count } = await supabase
          .from('specialties').select('*', { count: 'exact' }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'financial_categories': {
        const { data, error, count } = await supabase
          .from('financial_categories').select('*', { count: 'exact' }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'professionals': {
        const { data, error, count } = await supabase
          .from('professionals').select('*', { count: 'exact' }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'professional_procedures': {
        const { data, error, count } = await supabase
          .from('professional_procedures').select('*', { count: 'exact' }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'professional_insurance_plans': {
        const { data, error, count } = await supabase
          .from('professional_insurance_plans').select('*', { count: 'exact' }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'professional_schedules': {
        const { data, error, count } = await supabase
          .from('professional_schedules').select('*', { count: 'exact' }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'patients': {
        const { data, error, count } = await supabase
          .from('patients').select('*', { count: 'exact' }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'patient_dependents': {
        const { data, error, count } = await supabase
          .from('patient_dependents').select('*', { count: 'exact' }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'patient_cards': {
        const { data, error, count } = await supabase
          .from('patient_cards').select('*', { count: 'exact' }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'appointments': {
        let query = supabase.from('appointments').select('*', { count: 'exact' })
        if (startDate) query = query.gte('appointment_date', startDate)
        if (endDate) query = query.lte('appointment_date', endDate)
        const { data, error, count } = await query.range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'medical_records': {
        const { data, error, count } = await supabase
          .from('medical_records').select('*', { count: 'exact' }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'prescriptions': {
        const { data, error, count } = await supabase
          .from('prescriptions').select('*', { count: 'exact' }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'financial_transactions': {
        let query = supabase.from('financial_transactions').select('*', { count: 'exact' })
        if (startDate) query = query.gte('created_at', startDate)
        if (endDate) query = query.lte('created_at', endDate)
        const { data, error, count } = await query.range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'automation_flows': {
        const { data, error, count } = await supabase
          .from('automation_flows').select('*', { count: 'exact' }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'access_groups': {
        const { data, error, count } = await supabase
          .from('access_groups').select('*', { count: 'exact' }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'evolution_configs': {
        const { data, error, count } = await supabase
          .from('evolution_configs').select('*', { count: 'exact' }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'employers': {
        const { data, error, count } = await supabase
          .from('employers').select('*', { count: 'exact' }).order('name').range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'contribution_types': {
        const { data, error, count } = await supabase
          .from('contribution_types').select('*', { count: 'exact' }).order('name').range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      case 'employer_contributions': {
        const { data, error, count } = await supabase
          .from('employer_contributions').select('*', { count: 'exact' }).order('due_date', { ascending: false }).range(offset, offset + limit - 1)
        if (error) throw error
        return success(data, count || 0)
      }

      default:
        console.error(`[data-export-api] Unknown endpoint: ${endpoint}`)
        return new Response(
          JSON.stringify({ error: `Endpoint not found: ${endpoint}` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (err: any) {
    console.error('[data-export-api] Error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
