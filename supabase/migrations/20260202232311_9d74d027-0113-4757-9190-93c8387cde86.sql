-- =============================================
-- FIX: Monthly appointment limit validation
-- 
-- PROBLEMA: A validação atual conta agendamentos POR PROFISSIONAL
-- (ex: paciente pode agendar 1x com Dr. A, 1x com Dr. B, 1x com Dr. C no mesmo mês)
-- 
-- CORREÇÃO: Validar limite GLOBAL (1 agendamento por mês = 1 total, não 1 por profissional)
-- =============================================

-- 1. Corrigir validação para TITULAR (paciente principal)
CREATE OR REPLACE FUNCTION public.validate_appointment_cpf_restriction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  clinic_max_appointments INTEGER;
  patient_max_appointments INTEGER;
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

  -- Check for no-show block on patient - BY PROFESSIONAL
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

  -- Get clinic's default limit
  SELECT max_appointments_per_cpf_month INTO clinic_max_appointments
  FROM clinics
  WHERE id = NEW.clinic_id;
  
  -- Get patient's individual limit (overrides clinic default if set)
  SELECT max_appointments_per_month INTO patient_max_appointments
  FROM patients
  WHERE id = NEW.patient_id;
  
  -- Use patient's individual limit if set, otherwise use clinic's default
  max_appointments := COALESCE(patient_max_appointments, clinic_max_appointments);
  
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
  
  -- FIX: Count existing appointments in the same month for the TITULAR
  -- REMOVE: professional_id filter - now validates GLOBAL monthly limit
  SELECT COUNT(*) INTO existing_count
  FROM appointments a
  INNER JOIN patients p ON a.patient_id = p.id
  WHERE a.clinic_id = NEW.clinic_id
    AND p.cpf = patient_cpf
    AND a.appointment_date >= month_start
    AND a.appointment_date <= month_end
    AND a.status NOT IN ('cancelled', 'no_show')
    AND a.dependent_id IS NULL  -- Only count titular's own appointments
    AND a.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF existing_count >= max_appointments THEN
    RAISE EXCEPTION 'LIMITE_AGENDAMENTO_CPF: Você já atingiu o limite de % agendamento(s) neste mês. O próximo agendamento será permitido no mês seguinte.', max_appointments;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. Corrigir validação para DEPENDENTES
CREATE OR REPLACE FUNCTION public.validate_dependent_appointment_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  clinic_max_appointments INTEGER;
  patient_max_appointments INTEGER;
  max_appointments INTEGER;
  existing_count INTEGER;
  month_start DATE;
  month_end DATE;
  dependent_name TEXT;
BEGIN
  -- Only validate if this is a dependent appointment
  IF NEW.dependent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip validation for cancellations and no_show appointments
  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- Skip validation on UPDATE if status is changing to cancelled/no_show
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- Get clinic's configured limit
  SELECT max_appointments_per_cpf_month INTO clinic_max_appointments
  FROM clinics
  WHERE id = NEW.clinic_id;
  
  -- Get patient's (titular) individual limit - dependents use the titular's limit
  SELECT max_appointments_per_month INTO patient_max_appointments
  FROM patients
  WHERE id = NEW.patient_id;
  
  -- Use patient's individual limit if set, otherwise use clinic's default
  max_appointments := COALESCE(patient_max_appointments, clinic_max_appointments);
  
  -- If no limit configured (NULL or 0), allow unlimited
  IF max_appointments IS NULL OR max_appointments = 0 THEN
    RETURN NEW;
  END IF;

  -- Get dependent name for error message
  SELECT name INTO dependent_name
  FROM patient_dependents
  WHERE id = NEW.dependent_id;

  -- Calculate month boundaries for the appointment date
  month_start := date_trunc('month', NEW.appointment_date)::date;
  month_end := (date_trunc('month', NEW.appointment_date) + interval '1 month' - interval '1 day')::date;
  
  -- FIX: Count existing appointments in the same month for the same DEPENDENT
  -- REMOVE: professional_id filter - now validates GLOBAL monthly limit per dependent
  SELECT COUNT(*) INTO existing_count
  FROM appointments a
  WHERE a.clinic_id = NEW.clinic_id
    AND a.dependent_id = NEW.dependent_id
    AND a.appointment_date >= month_start
    AND a.appointment_date <= month_end
    AND a.status NOT IN ('cancelled', 'no_show')
    AND a.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF existing_count >= max_appointments THEN
    RAISE EXCEPTION 'LIMITE_AGENDAMENTO_DEPENDENTE: O dependente % já atingiu o limite de % agendamento(s) neste mês. O próximo agendamento será permitido no mês seguinte.', COALESCE(dependent_name, 'selecionado'), max_appointments;
  END IF;
  
  RETURN NEW;
END;
$function$;