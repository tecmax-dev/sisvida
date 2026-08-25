
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"
import { requireUser, authErrorResponse } from "../_shared/authGuard.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  let auth
  try {
    auth = await requireUser(req)
  } catch (authErr) {
    const denied = authErrorResponse(authErr, corsHeaders)
    if (denied) return denied
    throw authErr
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { appointmentId, action, cancellationReason } = await req.json()

    if (!appointmentId) {
      throw new Error('Appointment ID is required')
    }

    let updateData: any = {}

    if (action === 'confirm') {
      updateData = {
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      }
    } else if (action === 'cancel') {
      updateData = {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: cancellationReason || 'Cancelado pelo usuário via App',
      }
    } else if (action === 'arrive') {
      updateData = {
        status: 'arrived',
      }
    } else {
      throw new Error(`Invalid action: ${action}`)
    }

    const { data: appointment, error: fetchError } = await supabaseClient
      .from('appointments')
      .select('*, patient:patients(name, phone), professional:professionals(name), clinic:clinics(name)')
      .eq('id', appointmentId)
      .single()

    if (fetchError || !appointment) {
      throw new Error('Appointment not found')
    }

    // Ownership check: staff may act on any appointment of their clinics,
    // patients only on their own appointments.
    if (!auth.isStaff) {
      if (!auth.patientId || auth.patientId !== appointment.patient_id) {
        return new Response(JSON.stringify({ error: 'FORBIDDEN' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else if (!auth.isSuperAdmin) {
      const { data: access } = await supabaseClient.rpc('has_clinic_access', {
        _user_id: auth.userId,
        _clinic_id: appointment.clinic_id,
      })
      if (access !== true) {
        return new Response(JSON.stringify({ error: 'FORBIDDEN' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const { error: updateError } = await supabaseClient
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId)

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
