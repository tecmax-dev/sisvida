import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BookingRequest {
  clinicId: string;
  professionalId: string;
  date: string;
  time: string;
  type: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  procedureId?: string;
  insurancePlanId?: string;
  durationMinutes: number;
}

// Simple in-memory rate limiting (per instance)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const key = ip;
  const limit = rateLimits.get(key);
  
  if (!limit || now > limit.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + 3600000 }); // 1 hour window
    return false;
  }
  
  if (limit.count >= 10) { // Max 10 bookings per hour per IP
    return true;
  }
  
  limit.count++;
  return false;
}

function errorResponse(message: string, status = 400) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting check
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    if (isRateLimited(clientIP)) {
      console.error(`[create-public-booking] Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Limite de agendamentos excedido. Tente novamente em 1 hora.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: BookingRequest = await req.json();
    const {
      clinicId,
      professionalId,
      date,
      time,
      type,
      patientName,
      patientPhone,
      patientEmail,
      procedureId,
      insurancePlanId,
      durationMinutes
    } = body;

    // ============ INPUT VALIDATION ============

    // UUID validation regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Validate clinicId
    if (!clinicId || !uuidRegex.test(clinicId)) {
      return errorResponse('ID da clínica inválido');
    }

    // Validate professionalId
    if (!professionalId || !uuidRegex.test(professionalId)) {
      return errorResponse('ID do profissional inválido');
    }

    // Validate date format (YYYY-MM-DD)
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return errorResponse('Formato de data inválido');
    }

    // Validate date is not in past and within 90 days
    const bookingDate = new Date(date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 90);
    
    if (bookingDate < today) {
      return errorResponse('Não é possível agendar para datas passadas');
    }
    if (bookingDate > maxDate) {
      return errorResponse('Agendamentos permitidos apenas para os próximos 90 dias');
    }

    // Validate time format (HH:MM)
    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
      return errorResponse('Formato de horário inválido');
    }

    // Validate time is within business hours (06:00 - 22:00)
    const [hours, minutes] = time.split(':').map(Number);
    if (hours < 6 || hours > 22 || minutes < 0 || minutes > 59) {
      return errorResponse('Horário fora do expediente permitido');
    }

    // Validate appointment type
    const validTypes = ['first_visit', 'return', 'exam', 'procedure'];
    if (!type || !validTypes.includes(type)) {
      return errorResponse('Tipo de consulta inválido');
    }

    // Validate patient name
    const trimmedName = patientName?.trim();
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 100) {
      return errorResponse('Nome deve ter entre 2 e 100 caracteres');
    }
    // Allow only letters, spaces, hyphens, apostrophes, and common accented characters
    if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(trimmedName)) {
      return errorResponse('Nome contém caracteres inválidos');
    }

    // Validate phone (Brazilian format: 10-11 digits)
    const cleanPhone = patientPhone?.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10 || cleanPhone.length > 11) {
      return errorResponse('Telefone deve ter 10 ou 11 dígitos');
    }

    // Validate email if provided
    let cleanEmail: string | null = null;
    if (patientEmail && patientEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(patientEmail.trim()) || patientEmail.length > 255) {
        return errorResponse('Email inválido');
      }
      cleanEmail = patientEmail.trim().toLowerCase();
    }

    // Validate optional UUIDs
    if (procedureId && !uuidRegex.test(procedureId)) {
      return errorResponse('ID do procedimento inválido');
    }
    if (insurancePlanId && !uuidRegex.test(insurancePlanId)) {
      return errorResponse('ID do plano de saúde inválido');
    }

    // Validate duration
    if (!durationMinutes || durationMinutes < 5 || durationMinutes > 480) {
      return errorResponse('Duração da consulta inválida');
    }

    // ============ DATABASE OPERATIONS ============

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify clinic exists and is not blocked
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, is_blocked')
      .eq('id', clinicId)
      .single();

    if (clinicError || !clinic) {
      console.error('[create-public-booking] Clinic not found:', clinicId);
      return errorResponse('Clínica não encontrada', 404);
    }

    if (clinic.is_blocked) {
      return errorResponse('Esta clínica não está aceitando agendamentos no momento');
    }

    // Verify professional exists, is active, and belongs to clinic
    const { data: professional, error: profError } = await supabase
      .from('professionals')
      .select('id, is_active, schedule, appointment_duration')
      .eq('id', professionalId)
      .eq('clinic_id', clinicId)
      .single();

    if (profError || !professional) {
      console.error('[create-public-booking] Professional not found:', professionalId);
      return errorResponse('Profissional não encontrado', 404);
    }

    if (!professional.is_active) {
      return errorResponse('Este profissional não está disponível');
    }

    // Verify procedure belongs to clinic (if provided)
    if (procedureId) {
      const { data: procedure, error: procError } = await supabase
        .from('procedures')
        .select('id, is_active')
        .eq('id', procedureId)
        .eq('clinic_id', clinicId)
        .single();

      if (procError || !procedure || !procedure.is_active) {
        return errorResponse('Procedimento não disponível', 404);
      }
    }

    // Calculate end time
    const endDate = new Date(`2000-01-01T${time}:00`);
    endDate.setMinutes(endDate.getMinutes() + durationMinutes);
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    // Check for existing appointment at this slot (race condition protection)
    const { data: existingAppt } = await supabase
      .from('appointments')
      .select('id')
      .eq('professional_id', professionalId)
      .eq('appointment_date', date)
      .eq('start_time', time)
      .in('status', ['scheduled', 'confirmed'])
      .limit(1);

    if (existingAppt && existingAppt.length > 0) {
      return errorResponse('Este horário já está ocupado. Por favor, escolha outro horário.');
    }

    // Find or create patient
    let patientId: string;

    const { data: existingPatient } = await supabase
      .from('patients')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('phone', cleanPhone)
      .single();

    if (existingPatient) {
      patientId = existingPatient.id;
      console.log(`[create-public-booking] Found existing patient: ${patientId}`);
    } else {
      const { data: newPatient, error: patientError } = await supabase
        .from('patients')
        .insert({
          clinic_id: clinicId,
          name: trimmedName,
          phone: cleanPhone,
          email: cleanEmail,
          insurance_plan_id: insurancePlanId || null,
        })
        .select('id')
        .single();

      if (patientError) {
        console.error('[create-public-booking] Error creating patient:', patientError);
        return errorResponse('Erro ao criar cadastro do paciente', 500);
      }
      patientId = newPatient.id;
      console.log(`[create-public-booking] Created new patient: ${patientId}`);
    }

    // Create appointment
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        professional_id: professionalId,
        procedure_id: procedureId || null,
        appointment_date: date,
        start_time: time,
        end_time: endTime,
        duration_minutes: durationMinutes,
        type: type,
        status: 'scheduled',
      })
      .select('id')
      .single();

    if (apptError) {
      console.error('[create-public-booking] Error creating appointment:', apptError);
      
      // Check for schedule validation errors
      if (apptError.message?.includes('HORARIO_INVALIDO')) {
        const match = apptError.message.match(/HORARIO_INVALIDO:\s*(.+)/);
        return errorResponse(match ? match[1].trim() : 'O profissional não atende neste horário.');
      }
      
      return errorResponse('Erro ao criar agendamento. Tente novamente.', 500);
    }

    console.log(`[create-public-booking] Booking created successfully: ${appointment.id} for patient ${patientId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { 
          appointmentId: appointment.id,
          patientId: patientId,
          date,
          time,
          endTime
        } 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[create-public-booking] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
