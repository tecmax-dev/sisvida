
CREATE OR REPLACE FUNCTION public.validate_appointment_no_conflict()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only validate active appointments (skip cancelled, completed, no_show, blocked)
  IF NEW.status IN ('cancelled', 'completed', 'no_show', 'blocked') THEN
    RETURN NEW;
  END IF;

  -- Check for overlapping appointments (only against active ones)
  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.professional_id = NEW.professional_id
      AND a.appointment_date = NEW.appointment_date
      AND a.id IS DISTINCT FROM NEW.id
      AND a.status NOT IN ('cancelled', 'completed', 'no_show', 'blocked')
      AND a.start_time < NEW.end_time
      AND NEW.start_time < a.end_time
  ) THEN
    RAISE EXCEPTION 'CONFLITO: Já existe um agendamento para este profissional neste horário (% - %). Escolha outro horário.',
      NEW.start_time, NEW.end_time;
  END IF;

  RETURN NEW;
END;
$$;
