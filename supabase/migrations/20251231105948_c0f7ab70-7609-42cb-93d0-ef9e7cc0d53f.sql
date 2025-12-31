-- Fix: CPF restriction should NOT apply to dependent appointments
-- Update the function to skip validation when appointment has a dependent_id

CREATE OR REPLACE FUNCTION public.validate_appointment_cpf_restriction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_appointments INTEGER;
  patient_cpf TEXT;
  existing_count INTEGER;
  month_start DATE;
  month_end DATE;
  patient_blocked_until DATE;
  patient_unblocked_at TIMESTAMPTZ;
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

  -- Check for no-show block on patient
  SELECT no_show_blocked_until, no_show_unblocked_at 
  INTO patient_blocked_until, patient_unblocked_at
  FROM patients
  WHERE id = NEW.patient_id;
  
  -- If patient is blocked and not unblocked by admin
  IF patient_blocked_until IS NOT NULL 
     AND patient_blocked_until >= CURRENT_DATE 
     AND patient_unblocked_at IS NULL THEN
    RAISE EXCEPTION 'PACIENTE_BLOQUEADO_NO_SHOW: Este paciente está bloqueado para agendamentos até % devido a não comparecimento. Solicite liberação ao administrador.', to_char(patient_blocked_until, 'DD/MM/YYYY');
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
$$;

-- Update dependent limit function to use clinic's configured limit
CREATE OR REPLACE FUNCTION public.validate_dependent_appointment_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
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

  -- Get clinic's configured limit (same as titular)
  SELECT max_appointments_per_cpf_month INTO max_appointments
  FROM clinics
  WHERE id = NEW.clinic_id;
  
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
  
  -- Count existing appointments in the same month for the same professional and dependent
  SELECT COUNT(*) INTO existing_count
  FROM appointments a
  WHERE a.clinic_id = NEW.clinic_id
    AND a.professional_id = NEW.professional_id
    AND a.dependent_id = NEW.dependent_id
    AND a.appointment_date >= month_start
    AND a.appointment_date <= month_end
    AND a.status NOT IN ('cancelled', 'no_show')
    AND a.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF existing_count >= max_appointments THEN
    RAISE EXCEPTION 'LIMITE_AGENDAMENTO_DEPENDENTE: O dependente % já atingiu o limite de % agendamento(s) com este profissional neste mês.', COALESCE(dependent_name, 'selecionado'), max_appointments;
  END IF;
  
  RETURN NEW;
END;
$$;