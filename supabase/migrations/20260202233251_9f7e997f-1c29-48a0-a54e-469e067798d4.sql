-- Reverter para lógica original: 1 agendamento por CPF por profissional (não global)

-- Função para validar limite de agendamento por CPF (POR PROFISSIONAL)
CREATE OR REPLACE FUNCTION public.validate_appointment_cpf_restriction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clinic_limit INT;
  patient_limit INT;
  existing_count INT;
  month_start DATE;
  month_end DATE;
  patient_cpf TEXT;
BEGIN
  -- Only validate for new appointments or when changing date/professional
  IF TG_OP = 'UPDATE' AND 
     OLD.appointment_date = NEW.appointment_date AND 
     OLD.professional_id = NEW.professional_id AND
     OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Skip validation for cancelled or no_show
  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- Skip if there's a dependent (handled by separate trigger)
  IF NEW.dependent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get limits
  SELECT max_appointments_per_cpf_month INTO clinic_limit
  FROM clinics WHERE id = NEW.clinic_id;

  SELECT max_appointments_per_month INTO patient_limit
  FROM patients WHERE id = NEW.patient_id;

  -- Use patient limit if set, otherwise clinic limit
  -- 0 or NULL means unlimited
  IF patient_limit IS NOT NULL THEN
    IF patient_limit = 0 THEN
      RETURN NEW; -- Unlimited
    END IF;
    clinic_limit := patient_limit;
  ELSIF clinic_limit IS NULL OR clinic_limit = 0 THEN
    RETURN NEW; -- Unlimited
  END IF;

  -- Calculate month boundaries
  month_start := date_trunc('month', NEW.appointment_date)::date;
  month_end := (date_trunc('month', NEW.appointment_date) + interval '1 month' - interval '1 day')::date;

  -- Count existing appointments for THIS PROFESSIONAL in the month
  SELECT COUNT(*) INTO existing_count
  FROM appointments a
  WHERE a.clinic_id = NEW.clinic_id
    AND a.patient_id = NEW.patient_id
    AND a.professional_id = NEW.professional_id  -- POR PROFISSIONAL
    AND a.dependent_id IS NULL
    AND a.appointment_date >= month_start
    AND a.appointment_date <= month_end
    AND a.status NOT IN ('cancelled', 'no_show')
    AND (TG_OP = 'INSERT' OR a.id != NEW.id);

  IF existing_count >= clinic_limit THEN
    RAISE EXCEPTION 'LIMITE_AGENDAMENTO_CPF: Já existe agendamento para este profissional neste mês';
  END IF;

  RETURN NEW;
END;
$$;

-- Função para validar limite de agendamento por dependente (POR PROFISSIONAL)
CREATE OR REPLACE FUNCTION public.validate_dependent_appointment_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clinic_limit INT;
  existing_count INT;
  month_start DATE;
  month_end DATE;
BEGIN
  -- Only validate if there's a dependent
  IF NEW.dependent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only validate for new appointments or when changing date/professional/status
  IF TG_OP = 'UPDATE' AND 
     OLD.appointment_date = NEW.appointment_date AND 
     OLD.professional_id = NEW.professional_id AND
     OLD.dependent_id = NEW.dependent_id AND
     OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Skip validation for cancelled or no_show
  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- Get clinic limit (dependents always use clinic limit, default 1)
  SELECT COALESCE(max_appointments_per_cpf_month, 1) INTO clinic_limit
  FROM clinics WHERE id = NEW.clinic_id;

  -- 0 means unlimited
  IF clinic_limit = 0 THEN
    RETURN NEW;
  END IF;

  -- Calculate month boundaries
  month_start := date_trunc('month', NEW.appointment_date)::date;
  month_end := (date_trunc('month', NEW.appointment_date) + interval '1 month' - interval '1 day')::date;

  -- Count existing appointments for THIS DEPENDENT with THIS PROFESSIONAL in the month
  SELECT COUNT(*) INTO existing_count
  FROM appointments a
  WHERE a.clinic_id = NEW.clinic_id
    AND a.dependent_id = NEW.dependent_id
    AND a.professional_id = NEW.professional_id  -- POR PROFISSIONAL
    AND a.appointment_date >= month_start
    AND a.appointment_date <= month_end
    AND a.status NOT IN ('cancelled', 'no_show')
    AND (TG_OP = 'INSERT' OR a.id != NEW.id);

  IF existing_count >= clinic_limit THEN
    RAISE EXCEPTION 'LIMITE_AGENDAMENTO_DEPENDENTE: Já existe agendamento para este dependente com este profissional neste mês';
  END IF;

  RETURN NEW;
END;
$$;