CREATE OR REPLACE FUNCTION public.validate_titular_age_minimum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_age integer;
BEGIN
  -- Regra vale apenas para titular sindical
  IF COALESCE(NEW.is_union_member, false) <> true THEN
    RETURN NEW;
  END IF;

  -- Em UPDATE, só revalidar se campos relevantes mudaram
  IF TG_OP = 'UPDATE'
     AND NEW.birth_date IS NOT DISTINCT FROM OLD.birth_date
     AND NEW.is_union_member IS NOT DISTINCT FROM OLD.is_union_member THEN
    RETURN NEW;
  END IF;

  -- Se titular não tiver nascimento informado, deixa outras validações tratarem
  IF NEW.birth_date IS NULL THEN
    RETURN NEW;
  END IF;

  v_age := DATE_PART('year', AGE(CURRENT_DATE, NEW.birth_date));

  IF v_age < 18 THEN
    RAISE EXCEPTION 'TITULAR_MENOR_IDADE: O cadastro titular deve ser de pessoa maior de 18 anos. Idade calculada: % anos.', v_age;
  END IF;

  RETURN NEW;
END;
$function$;