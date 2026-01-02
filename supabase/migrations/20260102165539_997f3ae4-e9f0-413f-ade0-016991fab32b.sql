-- Adicionar coluna para registrar o profissional que originou o bloqueio de no-show
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS no_show_blocked_professional_id UUID REFERENCES professionals(id);

-- Atualizar função de bloqueio para registrar o profissional
CREATE OR REPLACE FUNCTION public.handle_no_show_block()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  block_end_date DATE;
BEGIN
  -- Only process when status changes TO 'no_show'
  IF NEW.status = 'no_show' AND (OLD.status IS NULL OR OLD.status != 'no_show') THEN
    -- Bloquear por 30 dias a partir de hoje
    block_end_date := CURRENT_DATE + INTERVAL '30 days';
    
    -- Update patient with block info including the professional that caused the block
    UPDATE patients
    SET 
      no_show_blocked_until = block_end_date,
      no_show_blocked_at = NOW(),
      no_show_blocked_professional_id = NEW.professional_id,
      no_show_unblocked_by = NULL,
      no_show_unblocked_at = NULL
    WHERE id = NEW.patient_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Atualizar função de validação de agendamento para verificar bloqueio por profissional
CREATE OR REPLACE FUNCTION public.validate_appointment_cpf_restriction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  max_appointments INTEGER;
  patient_cpf TEXT;
  existing_count INTEGER;
  month_start DATE;
  month_end DATE;
  patient_blocked_until DATE;
  patient_unblocked_at TIMESTAMPTZ;
  patient_blocked_professional_id UUID;
BEGIN
  -- Skip validation for cancellations and no_show appointments
  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- Skip validation on UPDATE if status is changing to cancelled/no_show
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- SKIP CPF VALIDATION FOR DEPENDENT APPOINTMENTS
  -- Dependents have their own validation via validate_dependent_appointment_limit
  IF NEW.dependent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Check for no-show block on patient - NOW BY PROFESSIONAL
  SELECT no_show_blocked_until, no_show_unblocked_at, no_show_blocked_professional_id 
  INTO patient_blocked_until, patient_unblocked_at, patient_blocked_professional_id
  FROM patients
  WHERE id = NEW.patient_id;
  
  -- If patient is blocked for THIS SPECIFIC PROFESSIONAL and not unblocked by admin
  IF patient_blocked_until IS NOT NULL 
     AND patient_blocked_until >= CURRENT_DATE 
     AND patient_unblocked_at IS NULL 
     AND patient_blocked_professional_id = NEW.professional_id THEN
    RAISE EXCEPTION 'PACIENTE_BLOQUEADO_NO_SHOW: Este paciente está bloqueado para agendamentos com este profissional até % devido a não comparecimento. Solicite liberação ao administrador.', to_char(patient_blocked_until, 'DD/MM/YYYY');
  END IF;

  -- Check if clinic has restriction configured
  SELECT max_appointments_per_cpf_month INTO max_appointments
  FROM clinics
  WHERE id = NEW.clinic_id;
  
  -- If no limit configured (NULL or 0), allow
  IF max_appointments IS NULL OR max_appointments = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Get patient CPF
  SELECT cpf INTO patient_cpf
  FROM patients
  WHERE id = NEW.patient_id;
  
  -- If no CPF, allow (can't validate)
  IF patient_cpf IS NULL OR patient_cpf = '' THEN
    RETURN NEW;
  END IF;
  
  -- Calculate month boundaries for the NEW appointment date
  month_start := date_trunc('month', NEW.appointment_date)::date;
  month_end := (date_trunc('month', NEW.appointment_date) + interval '1 month' - interval '1 day')::date;
  
  -- Count existing appointments in the same month for the same professional
  -- Only count TITULAR appointments (dependent_id IS NULL)
  SELECT COUNT(*) INTO existing_count
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  WHERE a.clinic_id = NEW.clinic_id
    AND a.professional_id = NEW.professional_id
    AND a.appointment_date >= month_start
    AND a.appointment_date <= month_end
    AND p.cpf = patient_cpf
    AND a.dependent_id IS NULL  -- Only count titular appointments
    AND a.status NOT IN ('cancelled', 'no_show')
    AND a.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF existing_count >= max_appointments THEN
    RAISE EXCEPTION 'LIMITE_AGENDAMENTO_CPF: Este paciente já atingiu o limite de % agendamento(s) com este profissional neste mês.', max_appointments;
  END IF;
  
  RETURN NEW;
END;
$function$;