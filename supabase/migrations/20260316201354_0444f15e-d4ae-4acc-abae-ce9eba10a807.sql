
CREATE OR REPLACE FUNCTION public.validate_dependent_appointment_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  clinic_limit INT;
  existing_count INT;
  month_start DATE;
  month_end DATE;
  current_user_id uuid;
  user_is_admin boolean;
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

  -- Check if current user is admin - admins can bypass the limit
  current_user_id := auth.uid();
  IF current_user_id IS NOT NULL THEN
    user_is_admin := public.is_clinic_admin(current_user_id, NEW.clinic_id);
    IF user_is_admin THEN
      RETURN NEW; -- Admin bypass
    END IF;
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

  -- Count existing appointments for ANY DEPENDENT of this TITULAR (patient_id)
  -- with THIS PROFESSIONAL in the month
  -- This prevents a titular from booking multiple dependents with the same professional
  SELECT COUNT(*) INTO existing_count
  FROM appointments a
  WHERE a.clinic_id = NEW.clinic_id
    AND a.patient_id = NEW.patient_id
    AND a.dependent_id IS NOT NULL
    AND a.professional_id = NEW.professional_id
    AND a.appointment_date >= month_start
    AND a.appointment_date <= month_end
    AND a.status NOT IN ('cancelled', 'no_show')
    AND (TG_OP = 'INSERT' OR a.id != NEW.id);

  IF existing_count >= clinic_limit THEN
    RAISE EXCEPTION 'LIMITE_AGENDAMENTO_DEPENDENTE: Já existe agendamento de dependente para este profissional neste mês. Limite: 1 dependente por profissional por mês.';
  END IF;

  RETURN NEW;
END;
$function$;
