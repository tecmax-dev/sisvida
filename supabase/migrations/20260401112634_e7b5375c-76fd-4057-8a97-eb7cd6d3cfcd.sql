
-- Trigger to prevent overlapping appointments for the same professional on the same date
CREATE OR REPLACE FUNCTION public.validate_appointment_no_conflict()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only validate non-cancelled appointments
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Check for overlapping appointments
  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.professional_id = NEW.professional_id
      AND a.appointment_date = NEW.appointment_date
      AND a.id IS DISTINCT FROM NEW.id
      AND a.status NOT IN ('cancelled')
      AND a.start_time < NEW.end_time
      AND NEW.start_time < a.end_time
  ) THEN
    RAISE EXCEPTION 'CONFLITO: Já existe um agendamento para este profissional neste horário (% - %). Escolha outro horário.',
      NEW.start_time, NEW.end_time;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS validate_appointment_conflict_trigger ON public.appointments;
CREATE TRIGGER validate_appointment_conflict_trigger
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_appointment_no_conflict();
