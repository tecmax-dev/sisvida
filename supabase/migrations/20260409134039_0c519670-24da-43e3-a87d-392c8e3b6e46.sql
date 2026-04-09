
-- Trigger: Impedir dependente com mesmo CPF de um associado (paciente) na mesma clínica
CREATE OR REPLACE FUNCTION public.check_dependent_cpf_not_associado()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  clean_cpf TEXT;
BEGIN
  -- Se não tem CPF, permite
  IF NEW.cpf IS NULL OR TRIM(NEW.cpf) = '' THEN
    RETURN NEW;
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
$$;

DROP TRIGGER IF EXISTS trg_check_dependent_cpf_not_associado ON public.patient_dependents;
CREATE TRIGGER trg_check_dependent_cpf_not_associado
  BEFORE INSERT OR UPDATE ON public.patient_dependents
  FOR EACH ROW
  EXECUTE FUNCTION public.check_dependent_cpf_not_associado();

-- Trigger: Impedir associado com mesmo CPF de um dependente na mesma clínica
CREATE OR REPLACE FUNCTION public.check_associado_cpf_not_dependent()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  clean_cpf TEXT;
BEGIN
  -- Só validar quando é membro do sindicato
  IF NEW.is_union_member IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Se não tem CPF, permite
  IF NEW.cpf IS NULL OR TRIM(NEW.cpf) = '' THEN
    RETURN NEW;
  END IF;

  clean_cpf := regexp_replace(NEW.cpf, '\D', '', 'g');

  -- Verificar se existe um dependente com o mesmo CPF na mesma clínica
  IF EXISTS (
    SELECT 1 FROM public.patient_dependents
    WHERE clinic_id = NEW.clinic_id
      AND is_active = true
      AND regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = clean_cpf
      AND clean_cpf <> ''
  ) THEN
    RAISE EXCEPTION 'CPF_DEPENDENTE_EXISTENTE: Este CPF já está cadastrado como dependente. Não é permitido cadastrar como associado/titular.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_associado_cpf_not_dependent ON public.patients;
CREATE TRIGGER trg_check_associado_cpf_not_dependent
  BEFORE INSERT OR UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.check_associado_cpf_not_dependent();
