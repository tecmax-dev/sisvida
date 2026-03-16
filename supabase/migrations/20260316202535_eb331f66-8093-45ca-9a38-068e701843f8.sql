
-- Add dependent booking config columns to clinics
ALTER TABLE public.clinics 
  ADD COLUMN IF NOT EXISTS dependent_booking_period text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS dependent_booking_limit integer DEFAULT 1;

-- Update the trigger to use the new configurable period and limit
CREATE OR REPLACE FUNCTION public.validate_dependent_appointment_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_period text;
  v_limit INT;
  existing_count INT;
  period_start DATE;
  period_end DATE;
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
      RETURN NEW;
    END IF;
  END IF;

  -- Get clinic config for dependent booking
  SELECT 
    COALESCE(dependent_booking_period, 'monthly'),
    COALESCE(dependent_booking_limit, 1)
  INTO v_period, v_limit
  FROM clinics WHERE id = NEW.clinic_id;

  -- 0 means unlimited
  IF v_limit = 0 THEN
    RETURN NEW;
  END IF;

  -- Calculate period boundaries based on config
  IF v_period = 'daily' THEN
    period_start := NEW.appointment_date::date;
    period_end := NEW.appointment_date::date;
  ELSIF v_period = 'weekly' THEN
    -- Monday-based week
    period_start := date_trunc('week', NEW.appointment_date)::date;
    period_end := (date_trunc('week', NEW.appointment_date) + interval '6 days')::date;
  ELSE
    -- monthly (default)
    period_start := date_trunc('month', NEW.appointment_date)::date;
    period_end := (date_trunc('month', NEW.appointment_date) + interval '1 month' - interval '1 day')::date;
  END IF;

  -- Count existing appointments for ANY DEPENDENT of this TITULAR (patient_id)
  -- with THIS PROFESSIONAL in the period
  SELECT COUNT(*) INTO existing_count
  FROM appointments a
  WHERE a.clinic_id = NEW.clinic_id
    AND a.patient_id = NEW.patient_id
    AND a.dependent_id IS NOT NULL
    AND a.professional_id = NEW.professional_id
    AND a.appointment_date >= period_start
    AND a.appointment_date <= period_end
    AND a.status NOT IN ('cancelled', 'no_show')
    AND (TG_OP = 'INSERT' OR a.id != NEW.id);

  IF existing_count >= v_limit THEN
    RAISE EXCEPTION 'LIMITE_AGENDAMENTO_DEPENDENTE: Limite de agendamentos de dependentes atingido para este profissional neste período. Limite: % por %.', v_limit, 
      CASE v_period 
        WHEN 'daily' THEN 'dia'
        WHEN 'weekly' THEN 'semana'
        ELSE 'mês'
      END;
  END IF;

  RETURN NEW;
END;
$function$;
