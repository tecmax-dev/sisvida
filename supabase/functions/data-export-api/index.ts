import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const GLOBAL_ENDPOINTS = new Set(['health', 'specialties'])

const selects = {
  clinics: 'id, name, slug, phone, email, address, cnpj, logo_url, opening_time, closing_time, reminder_hours, reminder_enabled, created_at, updated_at, enforce_schedule_validation, map_view_type, custom_map_embed_url, birthday_enabled, whatsapp_header_image_url, holidays_enabled, state_code, city, max_appointments_per_cpf_month, whatsapp_provider, use_ai_booking, entity_nomenclature, whatsapp_message_delay_seconds, hide_pending_before_date, booking_months_ahead, app_unavailable, app_unavailable_message, patient_swap_deadline_hours, min_advance_booking_hours, allow_multiple_sessions, dependent_booking_period, dependent_booking_limit, dependent_booking_limit_enabled, titular_booking_limit_enabled, payslip_acceptance_days, reminder_interval',
  patients: 'id, clinic_id, name, email, phone, cpf, birth_date, address, insurance_plan_id, notes, created_at, updated_at, record_code, is_company, is_foreigner, contact_name, rg, gender, birthplace, marital_status, height_cm, weight_kg, skin_color, priority, religion, cep, street, street_number, neighborhood, city, state, complement, landline, tag, referral, send_notifications, preferred_channel, profession, education, mother_name, father_name, no_show_blocked_until, no_show_blocked_at, no_show_unblocked_by, no_show_unblocked_at, is_active, inactivation_reason, inactivated_at, employer_cnpj, employer_name, no_show_blocked_professional_id, max_appointments_per_month, registration_number, photo_url, is_union_member, union_member_status, union_category_id, union_joined_at, union_contribution_value, union_payment_method, union_observations, union_join_date, signature_accepted, signature_accepted_at, admission_date, job_function, union_affiliation_date',
  patient_cards: 'id, clinic_id, patient_id, card_number, issued_at, expires_at, is_active, notes, created_by, created_at, updated_at',
  appointments: 'id, clinic_id, patient_id, professional_id, appointment_date, start_time, end_time, type, status, notes, reminder_sent, confirmed_at, cancelled_at, cancellation_reason, created_by, created_at, updated_at, started_at, completed_at, duration_minutes, procedure_id, dependent_id, recurrence_group_id, is_recurring',
  evolution_configs: 'id, clinic_id, instance_name, api_url, is_connected, connected_at, phone_number, created_at, updated_at, direct_reply_enabled, webhook_url, booking_enabled, external_webhook_url, instance_id',
  employers: 'id, clinic_id, cnpj, name, trade_name, email, phone, address, city, state, notes, is_active, created_at, updated_at, lytex_client_id, portal_last_access_at, category_id, cnae_code, cnae_description, cep, neighborhood, registration_number, union_entity_id',
  employer_contributions: 'id, clinic_id, employer_id, contribution_type_id, competence_month, competence_year, value, due_date, status, lytex_invoice_id, lytex_invoice_url, lytex_boleto_barcode, lytex_boleto_digitable_line, lytex_pix_code, paid_at, paid_value, payment_method, notes, created_by, created_at, updated_at, portal_reissue_count, negotiation_id, is_negotiated_debt, origin, union_entity_id, member_id, lytex_transaction_id, lytex_fee_amount, lytex_fee_details, net_value, is_reconciled, reconciled_at, reconciled_by, reconciliation_notes, has_divergence, divergence_details, financial_category_id, cash_register_id, imported_at, lytex_raw_data, is_editable, last_lytex_sync_at, lytex_original_status, active_competence_key, portal_value_change_count',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const apiKey = req.headers.get('x-api-key') || req.headers.get('X-API-Key')
    const expectedKey = Deno.env.get('SOURCE_API_KEY')

    if (!expectedKey) {
      console.error('[data-export-api] SOURCE_API_KEY not configured')
      return json({ error: 'Export API is not configured' }, 503)
    }

    if (!apiKey || apiKey !== expectedKey) {
      console.error('[data-export-api] Unauthorized - invalid API key')
      return json({ error: 'Unauthorized' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const endpoint = pathParts[pathParts.length - 1] || ''
    const clinicId = url.searchParams.get('clinic_id')?.trim() || ''

    if (!GLOBAL_ENDPOINTS.has(endpoint)) {
      if (!clinicId) return json({ error: 'clinic_id is required for this export endpoint' }, 400)
      if (!UUID_RE.test(clinicId)) return json({ error: 'Invalid clinic_id' }, 400)
    }

    const page = Math.max(parseInt(url.searchParams.get('page') || '1'), 1)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '1000'), 1), 5000)
    const offset = Math.max(parseInt(url.searchParams.get('offset') || String((page - 1) * limit)), 0)
    const startDate = url.searchParams.get('start_date')
    const endDate = url.searchParams.get('end_date')

    console.log('[data-export-api] export request', { endpoint, clinic_id: clinicId || null, limit, offset })

    const success = (data: unknown, total: number) => json({ data, total })
    const scoped = (table: string, select = '*') =>
      supabase.from(table).select(select, { count: 'estimated' }).eq('clinic_id', clinicId)

    const execute = async (query: any, orderColumn = 'id', ascending = true) => {
      const { data, error, count } = await query.order(orderColumn, { ascending }).range(offset, offset + limit - 1)
      if (error) throw error
      return success(data, count || 0)
    }

    const scopedProfessionalIds = async () => {
      const { data, error } = await supabase.from('professionals').select('id').eq('clinic_id', clinicId)
      if (error) throw error
      return (data || []).map((row: any) => row.id).filter(Boolean)
    }

    switch (endpoint) {
      case 'health':
        return json({ status: 'ok', timestamp: new Date().toISOString() })

      case 'clinics':
        return execute(supabase.from('clinics').select(selects.clinics, { count: 'estimated' }).eq('id', clinicId))

      case 'procedures':
        return execute(scoped('procedures'))

      case 'insurance_plans':
        return execute(scoped('insurance_plans'))

      case 'specialties':
        return execute(supabase.from('specialties').select('*', { count: 'estimated' }))

      case 'financial_categories':
        return execute(scoped('financial_categories'))

      case 'professionals':
        return execute(scoped('professionals'))

      case 'professional_procedures': {
        const professionalIds = await scopedProfessionalIds()
        if (professionalIds.length === 0) return success([], 0)
        return execute(supabase.from('professional_procedures').select('*', { count: 'estimated' }).in('professional_id', professionalIds))
      }
      case 'professional_insurance_plans': {
        const professionalIds = await scopedProfessionalIds()
        if (professionalIds.length === 0) return success([], 0)
        return execute(supabase.from('professional_insurance_plans').select('*', { count: 'estimated' }).in('professional_id', professionalIds))
      }
      case 'professional_schedules':
        return execute(scoped('professional_schedules'))
      case 'patients':
        return execute(scoped('patients', selects.patients))
      case 'patient_dependents':
        return execute(scoped('patient_dependents'))
      case 'patient_cards':
        return execute(scoped('patient_cards', selects.patient_cards))
      case 'appointments': {
        let query = scoped('appointments', selects.appointments)
        if (startDate) query = query.gte('appointment_date', startDate)
        if (endDate) query = query.lte('appointment_date', endDate)
        return execute(query)
      }
      case 'medical_records':
        return execute(scoped('medical_records'))
      case 'prescriptions':
        return execute(scoped('prescriptions'))
      case 'financial_transactions': {
        let query = scoped('financial_transactions')
        if (startDate) query = query.gte('created_at', startDate)
        if (endDate) query = query.lte('created_at', endDate)
        return execute(query)
      }
      case 'automation_flows':
        return execute(scoped('automation_flows'))
      case 'access_groups':
        return execute(scoped('access_groups'))
      case 'evolution_configs':
        return execute(scoped('evolution_configs', selects.evolution_configs))
      case 'employers':
        return execute(scoped('employers', selects.employers), 'name')
      case 'contribution_types':
        return execute(scoped('contribution_types'), 'name')
      case 'employer_contributions':
        return execute(scoped('employer_contributions', selects.employer_contributions), 'due_date', false)
      default:
        console.error(`[data-export-api] Unknown endpoint: ${endpoint}`)
        return json({ error: `Endpoint not found: ${endpoint}` }, 404)
    }
  } catch (err: any) {
    console.error('[data-export-api] Error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
