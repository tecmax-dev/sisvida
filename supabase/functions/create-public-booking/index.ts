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
  patientCpf?: string;
  procedureId?: string;
  insurancePlanId?: string;
  durationMinutes: number;
  dependentId?: string;
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
  // IMPORTANT: Return 200 for business/validation errors so the web app can always read { success, error }
  // without Supabase treating it as a transport error (“non-2xx”).
  return new Response(
    JSON.stringify({ success: false, error: message, status }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      return errorResponse('Limite de agendamentos excedido. Tente novamente em 1 hora.', 429);
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
      patientCpf,
      procedureId,
      insurancePlanId,
      durationMinutes,
      dependentId
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
    const validTypes = ['first_visit', 'return', 'exam', 'procedure', 'telemedicine'];
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

    // Validate CPF if provided (Brazilian format: 11 digits with verification)
    let cleanCpf: string | null = null;
    if (patientCpf && patientCpf.trim()) {
      cleanCpf = patientCpf.replace(/\D/g, '');
      if (cleanCpf.length !== 11) {
        return errorResponse('CPF deve ter 11 dígitos');
      }
      
      // Validate CPF check digits
      if (/^(\d)\1+$/.test(cleanCpf)) {
        return errorResponse('CPF inválido');
      }
      
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        sum += parseInt(cleanCpf[i]) * (10 - i);
      }
      let remainder = (sum * 10) % 11;
      if (remainder === 10 || remainder === 11) remainder = 0;
      if (remainder !== parseInt(cleanCpf[9])) {
        return errorResponse('CPF inválido');
      }
      
      sum = 0;
      for (let i = 0; i < 10; i++) {
        sum += parseInt(cleanCpf[i]) * (11 - i);
      }
      remainder = (sum * 10) % 11;
      if (remainder === 10 || remainder === 11) remainder = 0;
      if (remainder !== parseInt(cleanCpf[10])) {
        return errorResponse('CPF inválido');
      }
    }

    // Validate optional UUIDs
    if (procedureId && !uuidRegex.test(procedureId)) {
      return errorResponse('ID do procedimento inválido');
    }
    if (insurancePlanId && !uuidRegex.test(insurancePlanId)) {
      return errorResponse('ID do plano de saúde inválido');
    }
    if (dependentId && !uuidRegex.test(dependentId)) {
      return errorResponse('ID do dependente inválido');
    }

    // Validate duration
    if (!durationMinutes || durationMinutes < 5 || durationMinutes > 480) {
      return errorResponse('Duração da consulta inválida');
    }

    // ============ DATABASE OPERATIONS ============

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate dependent exists and is active if provided
    // CRITICAL: Also check pending_approval to block dependents awaiting approval
    let dependentData: { name: string; card_expires_at: string | null } | null = null;
    if (dependentId) {
      const { data: dependent, error: depError } = await supabase
        .from('patient_dependents')
        .select('id, name, card_expires_at, is_active, pending_approval')
        .eq('id', dependentId)
        .single();

      if (depError || !dependent) {
        return errorResponse('Dependente não encontrado');
      }
      
      // CRITICAL: Block dependents with pending_approval
      if (dependent.pending_approval === true) {
        console.log(`[create-public-booking] Dependent ${dependentId} blocked: pending_approval=true`);
        return errorResponse(`O cadastro de ${dependent.name} ainda está aguardando aprovação. Você será notificado quando for aprovado.`);
      }
      
      if (!dependent.is_active) {
        return errorResponse('Dependente não está ativo');
      }
      
      // Check if dependent has expired card
      if (dependent.card_expires_at && new Date(dependent.card_expires_at) < new Date()) {
        return errorResponse(`A carteirinha do dependente ${dependent.name} está vencida. Por favor, renove antes de agendar.`);
      }
      
      dependentData = { name: dependent.name, card_expires_at: dependent.card_expires_at };
      console.log(`[create-public-booking] Booking for dependent: ${dependent.name} (${dependentId})`);
    }

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
      .select('id, is_active, schedule, appointment_duration, telemedicine_enabled')
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

    // Validate telemedicine requirements
    if (type === 'telemedicine') {
      // Check if professional has telemedicine enabled
      if (!professional.telemedicine_enabled) {
        console.error('[create-public-booking] Professional does not offer telemedicine:', professionalId);
        return errorResponse('Este profissional não oferece consultas por telemedicina');
      }

      // Check if clinic plan includes telemedicine feature
      const { data: subscriptionData } = await supabase
        .from('subscriptions')
        .select('plan_id')
        .eq('clinic_id', clinicId)
        .in('status', ['trial', 'active'])
        .maybeSingle();

      if (!subscriptionData?.plan_id) {
        return errorResponse('O plano desta clínica não inclui telemedicina');
      }

      const { data: planFeature } = await supabase
        .from('plan_features')
        .select(`
          feature_id,
          system_features!inner(key)
        `)
        .eq('plan_id', subscriptionData.plan_id)
        .eq('system_features.key', 'telemedicine')
        .maybeSingle();

      if (!planFeature) {
        console.error('[create-public-booking] Clinic plan does not include telemedicine:', clinicId);
        return errorResponse('O plano desta clínica não inclui telemedicina');
      }

      console.log('[create-public-booking] Telemedicine validation passed for clinic:', clinicId);
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
    // Use overlap detection instead of exact match
    const { data: existingAppts } = await supabase
      .from('appointments')
      .select('id, start_time, end_time')
      .eq('professional_id', professionalId)
      .eq('appointment_date', date)
      .in('status', ['scheduled', 'confirmed', 'in_progress'])
      .lt('start_time', endTime)  // existing start < new end
      .gt('end_time', time);       // existing end > new start

    if (existingAppts && existingAppts.length > 0) {
      console.log(`[create-public-booking] Conflict detected with appointment ${existingAppts[0].id} (${existingAppts[0].start_time} - ${existingAppts[0].end_time})`);
      return errorResponse('HORARIO_INVALIDO: Este horário já está ocupado. Por favor, escolha outro horário.');
    }

    // Find or create patient
    let patientId: string;

    const { data: existingPatient } = await supabase
      .from('patients')
      .select('id, is_active')
      .eq('clinic_id', clinicId)
      .eq('phone', cleanPhone)
      .single();

    if (existingPatient) {
      // Check if existing patient is inactive
      if (existingPatient.is_active === false) {
        console.error('[create-public-booking] Patient is inactive:', existingPatient.id);
        return errorResponse('Seu cadastro está inativo. Entre em contato com a clínica para reativar.');
      }
      
      patientId = existingPatient.id;
      console.log(`[create-public-booking] Found existing patient: ${patientId}`);
      
      // Update CPF if provided and patient doesn't have one
      if (cleanCpf) {
        await supabase
          .from('patients')
          .update({ cpf: cleanCpf })
          .eq('id', patientId)
          .is('cpf', null);
      }
    } else {
      const { data: newPatient, error: patientError } = await supabase
        .from('patients')
        .insert({
          clinic_id: clinicId,
          name: trimmedName,
          phone: cleanPhone,
          email: cleanEmail,
          cpf: cleanCpf,
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
        dependent_id: dependentId || null,
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
      
      // Check for expired card errors
      if (apptError.message?.includes('CARTEIRINHA_VENCIDA')) {
        const match = apptError.message.match(/CARTEIRINHA_VENCIDA:\s*(.+)/);
        return errorResponse(match ? match[1].trim() : 'A carteirinha do paciente está vencida. Por favor, renove para agendar.');
      }
      
      // Check for expired dependent card errors
      if (apptError.message?.includes('CARTEIRINHA_DEPENDENTE_VENCIDA')) {
        const match = apptError.message.match(/CARTEIRINHA_DEPENDENTE_VENCIDA:\s*(.+)/);
        return errorResponse(match ? match[1].trim() : 'A carteirinha do dependente está vencida. Por favor, renove para agendar.');
      }
      
      // Check for CPF appointment limit errors
      if (apptError.message?.includes('LIMITE_AGENDAMENTO_CPF')) {
        const match = apptError.message.match(/LIMITE_AGENDAMENTO_CPF:\s*(.+)/);
        return errorResponse(match ? match[1].trim() : 'Limite de agendamentos atingido para este mês.');
      }
      
      // Check for no-show blocking errors
      if (apptError.message?.includes('PACIENTE_BLOQUEADO_NO_SHOW')) {
        const match = apptError.message.match(/PACIENTE_BLOQUEADO_NO_SHOW:\s*(.+)/);
        return errorResponse(match ? match[1].trim() : 'Paciente bloqueado por não comparecimento. Entre em contato com a clínica.');
      }
      
      // Check for invalid dependent errors
      if (apptError.message?.includes('DEPENDENTE_INVALIDO')) {
        const match = apptError.message.match(/DEPENDENTE_INVALIDO:\s*(.+)/);
        return errorResponse(match ? match[1].trim() : 'O dependente selecionado não está ativo.');
      }
      
      // Check for holiday errors
      if (apptError.message?.includes('FERIADO')) {
        const match = apptError.message.match(/FERIADO:\s*(.+)/);
        return errorResponse(match ? match[1].trim() : 'Não é possível agendar nesta data (feriado).');
      }
      
      return errorResponse('Erro ao criar agendamento. Tente novamente.', 500);
    }

    console.log(`[create-public-booking] Booking created successfully: ${appointment.id} for patient ${patientId}`);

    // If telemedicine, create session and send WhatsApp with link
    let telemedicineSession = null;
    if (type === 'telemedicine') {
      const roomId = `room_${appointment.id}_${Date.now()}`;
      
      const { data: session, error: sessionError } = await supabase
        .from('telemedicine_sessions')
        .insert({
          appointment_id: appointment.id,
          clinic_id: clinicId,
          room_id: roomId,
          status: 'waiting',
        })
        .select('id, patient_token')
        .single();

      if (sessionError) {
        console.error('[create-public-booking] Error creating telemedicine session:', sessionError);
      } else {
        telemedicineSession = session;
        console.log(`[create-public-booking] Telemedicine session created: ${session.id}`);

        // Get clinic and professional names for the message
        const { data: clinicData } = await supabase
          .from('clinics')
          .select('name')
          .eq('id', clinicId)
          .single();

        const { data: profData } = await supabase
          .from('professionals')
          .select('name')
          .eq('id', professionalId)
          .single();

        // Send WhatsApp with telemedicine link
        const telemedicineLink = `https://app.eclini.com.br/telemedicina/${session.patient_token}`;
        
        // Format date for display
        const [year, month, day] = date.split('-');
        const formattedDate = `${day}/${month}/${year}`;

        const message = [
          `Olá ${trimmedName}! 👋`,
          ``,
          `Sua *teleconsulta* foi agendada com sucesso!`,
          ``,
          `📅 *Data:* ${formattedDate}`,
          `🕐 *Horário:* ${time}`,
          `👨‍⚕️ *Profissional:* ${profData?.name || 'Profissional'}`,
          `🏥 *Clínica:* ${clinicData?.name || 'Clínica'}`,
          ``,
          `📹 *Link para a consulta:*`,
          telemedicineLink,
          ``,
          `⚠️ *Importante:*`,
          `• Acesse o link 5 minutos antes do horário`,
          `• Use um navegador atualizado (Chrome, Firefox, Safari)`,
          `• Verifique se sua câmera e microfone estão funcionando`,
          `• Escolha um local silencioso e bem iluminado`,
          ``,
          `Atenciosamente,`,
          `Equipe ${clinicData?.name || 'Clínica'}`,
        ].join('\n');

        // Check if clinic has Evolution API configured
        const { data: evolutionConfig } = await supabase
          .from('evolution_configs')
          .select('id, is_connected')
          .eq('clinic_id', clinicId)
          .eq('is_connected', true)
          .maybeSingle();

        if (evolutionConfig) {
          // Call send-whatsapp function
          try {
            const whatsappResponse = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                phone: cleanPhone,
                message: message,
                clinicId: clinicId,
                type: 'custom',
              }),
            });

            const whatsappResult = await whatsappResponse.json();
            if (whatsappResult.success) {
              console.log(`[create-public-booking] WhatsApp telemedicine link sent to ${cleanPhone}`);
            } else {
              console.error('[create-public-booking] Failed to send WhatsApp:', whatsappResult.error);
            }
          } catch (whatsappError) {
            console.error('[create-public-booking] Error sending WhatsApp:', whatsappError);
          }
        } else {
          console.log('[create-public-booking] Clinic has no Evolution API configured, skipping WhatsApp');
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { 
          appointmentId: appointment.id,
          patientId: patientId,
          date,
          time,
          endTime,
          telemedicineSession: telemedicineSession ? {
            id: telemedicineSession.id,
            patientToken: telemedicineSession.patient_token,
          } : null,
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
