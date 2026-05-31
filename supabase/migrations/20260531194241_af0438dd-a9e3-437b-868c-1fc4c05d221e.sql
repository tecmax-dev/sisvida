CREATE OR REPLACE FUNCTION public.validate_appointment_slot_not_blocked()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'completed', 'no_show', 'blocked') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointment_slot_blocks b
    WHERE b.clinic_id = NEW.clinic_id
      AND b.professional_id = NEW.professional_id
      AND b.block_date = NEW.appointment_date
      AND NEW.start_time < b.end_time
      AND NEW.end_time > b.start_time
  ) THEN
    RAISE EXCEPTION 'HORARIO_BLOQUEADO: Este horário foi bloqueado manualmente na agenda.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_validate_appointment_slot_not_blocked ON public.appointments;
CREATE TRIGGER trigger_validate_appointment_slot_not_blocked
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.validate_appointment_slot_not_blocked();