CREATE OR REPLACE FUNCTION public.validate_appointment_holiday()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result RECORD;
  v_override_exists BOOLEAN;
BEGIN
  -- Exceção do profissional: se houver registro em professional_schedule_exceptions
  -- para este profissional+data com is_day_off=false, ignora o bloqueio de feriado.
  SELECT EXISTS (
    SELECT 1 FROM professional_schedule_exceptions
    WHERE professional_id = NEW.professional_id
      AND clinic_id = NEW.clinic_id
      AND exception_date = NEW.appointment_date
      AND is_day_off = false
  ) INTO v_override_exists;

  IF v_override_exists THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_result FROM is_holiday(NEW.clinic_id, NEW.appointment_date);

  IF v_result.is_holiday = true THEN
    RAISE EXCEPTION 'FERIADO: Não é possível agendar nesta data. % (feriado %).', v_result.holiday_name, v_result.holiday_type;
  END IF;

  RETURN NEW;
END;
$function$;