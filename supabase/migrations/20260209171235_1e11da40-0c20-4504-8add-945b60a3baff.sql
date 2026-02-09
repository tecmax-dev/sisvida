
-- Trigger function: ao inserir um dependente, cria automaticamente um registro em patients (se não existir)
CREATE OR REPLACE FUNCTION public.sync_dependent_to_patients()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_id uuid;
  v_clean_cpf text;
BEGIN
  -- Só processa se o dependente tem CPF
  IF NEW.cpf IS NULL OR trim(NEW.cpf) = '' THEN
    RETURN NEW;
  END IF;

  -- Normaliza CPF (só dígitos)
  v_clean_cpf := regexp_replace(NEW.cpf, '\D', '', 'g');

  -- Verifica se já existe paciente com esse CPF na mesma clínica
  SELECT id INTO v_existing_id
  FROM public.patients
  WHERE clinic_id = NEW.clinic_id
    AND regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = v_clean_cpf
  LIMIT 1;

  -- Se não existe, cria o registro de paciente
  IF v_existing_id IS NULL THEN
    INSERT INTO public.patients (
      clinic_id,
      name,
      cpf,
      birth_date,
      is_active,
      notes
    ) VALUES (
      NEW.clinic_id,
      NEW.name,
      v_clean_cpf,
      NEW.birth_date,
      COALESCE(NEW.is_active, true),
      'Cadastrado automaticamente como dependente de sócio'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger no INSERT de patient_dependents
DROP TRIGGER IF EXISTS trg_sync_dependent_to_patients ON public.patient_dependents;
CREATE TRIGGER trg_sync_dependent_to_patients
  AFTER INSERT ON public.patient_dependents
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_dependent_to_patients();
