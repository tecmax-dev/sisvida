-- Create function to validate dependent appointment limit (1 per month per professional)
CREATE OR REPLACE FUNCTION public.validate_dependent_appointment_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
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
  
  -- Dependents have a fixed limit of 1 appointment per month per professional
  IF existing_count >= 1 THEN
    RAISE EXCEPTION 'LIMITE_AGENDAMENTO_DEPENDENTE: O dependente % já possui um agendamento com este profissional neste mês.', COALESCE(dependent_name, 'selecionado');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for dependent appointment limit validation
DROP TRIGGER IF EXISTS validate_dependent_appointment_limit_trigger ON public.appointments;

CREATE TRIGGER validate_dependent_appointment_limit_trigger
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_dependent_appointment_limit();