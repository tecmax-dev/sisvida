
CREATE OR REPLACE FUNCTION public.check_dependent_cpf_not_associado()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  clean_cpf TEXT;
BEGIN
  -- Se não tem CPF, permite
  IF NEW.cpf IS NULL OR TRIM(NEW.cpf) = '' THEN
    RETURN NEW;
  END IF;

  -- Em UPDATE, só valida se o CPF realmente mudou
  IF TG_OP = 'UPDATE' THEN
    IF OLD.cpf IS NOT DISTINCT FROM NEW.cpf THEN
      RETURN NEW;
    END IF;
  END IF;

  clean_cpf := regexp_replace(NEW.cpf, '\D', '', 'g');

  -- Verificar se existe um paciente (associado) com o mesmo CPF na mesma clínica
  IF EXISTS (
    SELECT 1 FROM public.patients
    WHERE clinic_id = NEW.clinic_id
      AND is_union_member = true
      AND is_active = true
      AND regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = clean_cpf
      AND clean_cpf <> ''
  ) THEN
    RAISE EXCEPTION 'CPF_ASSOCIADO_EXISTENTE: Este CPF já está cadastrado como associado/titular. Não é permitido cadastrar como dependente.';
  END IF;

  RETURN NEW;
END;
$function$;
