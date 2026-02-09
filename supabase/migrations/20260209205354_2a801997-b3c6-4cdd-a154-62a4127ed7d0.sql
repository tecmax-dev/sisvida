
-- 1) Atualizar a função de sync para copiar o telefone do titular
CREATE OR REPLACE FUNCTION public.sync_dependent_to_patients()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_id uuid;
  v_clean_cpf text;
  v_titular_phone text;
BEGIN
  -- Só processa se o dependente tem CPF
  IF NEW.cpf IS NULL OR trim(NEW.cpf) = '' THEN
    RETURN NEW;
  END IF;

  -- Normaliza CPF (só dígitos)
  v_clean_cpf := regexp_replace(NEW.cpf, '\D', '', 'g');

  -- Busca telefone do titular
  SELECT phone INTO v_titular_phone
  FROM public.patients
  WHERE id = NEW.patient_id;

  -- Verifica se já existe paciente com esse CPF na mesma clínica
  SELECT id INTO v_existing_id
  FROM public.patients
  WHERE clinic_id = NEW.clinic_id
    AND regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = v_clean_cpf
  LIMIT 1;

  -- Se não existe, cria o registro de paciente com telefone do titular
  IF v_existing_id IS NULL THEN
    INSERT INTO public.patients (
      clinic_id,
      name,
      cpf,
      birth_date,
      phone,
      is_active,
      notes
    ) VALUES (
      NEW.clinic_id,
      NEW.name,
      v_clean_cpf,
      NEW.birth_date,
      v_titular_phone,
      COALESCE(NEW.is_active, true),
      'Cadastrado automaticamente como dependente de sócio'
    );
  ELSE
    -- Se existe mas não tem telefone, atualiza com o do titular
    UPDATE public.patients
    SET phone = v_titular_phone
    WHERE id = v_existing_id
      AND (phone IS NULL OR phone = '')
      AND v_titular_phone IS NOT NULL AND v_titular_phone != '';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2) Atualizar em massa: pacientes dependentes sem telefone recebem o telefone do titular
UPDATE public.patients p_dep
SET phone = p_titular.phone
FROM patient_dependents pd
JOIN patients p_titular ON pd.patient_id = p_titular.id
WHERE p_dep.clinic_id = pd.clinic_id
  AND regexp_replace(COALESCE(p_dep.cpf,''), '\D', '', 'g') = regexp_replace(COALESCE(pd.cpf,''), '\D', '', 'g')
  AND pd.cpf IS NOT NULL AND pd.cpf != ''
  AND p_dep.id != p_titular.id
  AND (p_dep.phone IS NULL OR p_dep.phone = '')
  AND p_titular.phone IS NOT NULL AND p_titular.phone != '';
