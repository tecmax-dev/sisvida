-- Add toggle for titular booking limit
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS titular_booking_limit_enabled boolean DEFAULT true;

-- Update trigger to respect the enabled flag
CREATE OR REPLACE FUNCTION public.validate_appointment_cpf_restriction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  clinic_limit INT;
  patient_limit INT;
  v_enabled boolean;
  existing_count INT;
  month_start DATE;
  month_end DATE;
  current_user_id uuid;
  user_is_admin boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND 
     OLD.appointment_date = NEW.appointment_date AND 
     OLD.professional_id = NEW.professional_id AND
     OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  IF NEW.dependent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get enabled flag
  SELECT COALESCE(titular_booking_limit_enabled, true)
  INTO v_enabled
  FROM clinics WHERE id = NEW.clinic_id;

  IF NOT v_enabled THEN
    RETURN NEW;
  END IF;

  -- Check if current user is admin
  current_user_id := auth.uid();
  IF current_user_id IS NOT NULL THEN
    user_is_admin := public.is_clinic_admin(current_user_id, NEW.clinic_id);
    IF user_is_admin THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT max_appointments_per_cpf_month INTO clinic_limit
  FROM clinics WHERE id = NEW.clinic_id;

  SELECT max_appointments_per_month INTO patient_limit
  FROM patients WHERE id = NEW.patient_id;

  IF patient_limit IS NOT NULL THEN
    IF patient_limit = 0 THEN
      RETURN NEW;
    END IF;
    clinic_limit := patient_limit;
  ELSIF clinic_limit IS NULL OR clinic_limit = 0 THEN
    RETURN NEW;
  END IF;

  month_start := date_trunc('month', NEW.appointment_date)::date;
  month_end := (date_trunc('month', NEW.appointment_date) + interval '1 month' - interval '1 day')::date;

  SELECT COUNT(*) INTO existing_count
  FROM appointments a
  WHERE a.clinic_id = NEW.clinic_id
    AND a.patient_id = NEW.patient_id
    AND a.professional_id = NEW.professional_id
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
$function$;