
-- Trigger to prevent saving titular patients (non-dependents) under 18
CREATE OR REPLACE FUNCTION public.validate_titular_age_minimum()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_age integer;
BEGIN
  -- Only validate if birth_date is set
  IF NEW.birth_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate age
  v_age := DATE_PART('year', AGE(CURRENT_DATE, NEW.birth_date));

  -- Block if under 18
  IF v_age < 18 THEN
    RAISE EXCEPTION 'TITULAR_MENOR_IDADE: O cadastro titular deve ser de pessoa maior de 18 anos. Idade calculada: % anos.', v_age;
  END IF;

  RETURN NEW;
END;
$function$;

-- Apply trigger on INSERT and UPDATE of patients table
CREATE TRIGGER trg_validate_titular_age_minimum
  BEFORE INSERT OR UPDATE OF birth_date ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_titular_age_minimum();
