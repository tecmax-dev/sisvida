-- Corrigir bloqueio indevido no fluxo de dependentes do /sindicato
-- Causa: a trigger de sincronização tentava criar um paciente auxiliar já no INSERT do dependente pendente,
-- e a trigger de bloqueio de criação pública de pacientes no sindicato barrava essa criação.

CREATE OR REPLACE FUNCTION public.block_sindicato_patient_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    clinic_slug TEXT;
    allow_dependent_sync BOOLEAN;
BEGIN
    SELECT slug INTO clinic_slug FROM public.clinics WHERE id = NEW.clinic_id;

    IF clinic_slug = 'sindicato' THEN
        allow_dependent_sync := COALESCE(current_setting('app.allow_dependent_patient_sync', true), '') = 'true';

        -- Permite somente a criação feita internamente pela sincronização de dependentes aprovados.
        IF allow_dependent_sync THEN
            RETURN NEW;
        END IF;

        -- Permite criação manual feita por usuários internos autorizados.
        IF NOT EXISTS (
            SELECT 1
            FROM public.user_roles
            WHERE user_id = auth.uid()
              AND role::text IN ('admin', 'receptionist', 'owner', 'administrative', 'entidade_sindical_admin')
        ) THEN
            RAISE EXCEPTION 'Não é permitido criar novos cadastros para esta clínica. É necessário ter um cadastro de associado ativo no sindicato.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_dependent_to_patients()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_clean_cpf text;
  v_titular_phone text;
BEGIN
  -- Só sincroniza dependente efetivamente aprovado/ativo.
  -- Solicitações recém-enviadas ficam apenas em patient_dependents + pending_dependent_approvals.
  IF COALESCE(NEW.pending_approval, false) = true OR COALESCE(NEW.is_active, false) = false THEN
    RETURN NEW;
  END IF;

  IF NEW.cpf IS NULL OR trim(NEW.cpf) = '' THEN
    RETURN NEW;
  END IF;

  v_clean_cpf := regexp_replace(NEW.cpf, '\D', '', 'g');

  IF v_clean_cpf = '' THEN
    RETURN NEW;
  END IF;

  SELECT phone INTO v_titular_phone
  FROM public.patients
  WHERE id = NEW.patient_id;

  SELECT id INTO v_existing_id
  FROM public.patients
  WHERE clinic_id = NEW.clinic_id
    AND regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = v_clean_cpf
  LIMIT 1;

  IF v_existing_id IS NULL THEN
    PERFORM set_config('app.allow_dependent_patient_sync', 'true', true);

    INSERT INTO public.patients (
      clinic_id,
      name,
      cpf,
      birth_date,
      phone,
      is_active,
      is_union_member,
      notes
    ) VALUES (
      NEW.clinic_id,
      NEW.name,
      v_clean_cpf,
      NEW.birth_date,
      v_titular_phone,
      true,
      false,
      'Cadastrado automaticamente como dependente de sócio'
    );
  ELSE
    UPDATE public.patients
    SET
      phone = COALESCE(NULLIF(phone, ''), v_titular_phone),
      is_active = true,
      updated_at = now()
    WHERE id = v_existing_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_dependent_to_patients ON public.patient_dependents;
CREATE TRIGGER trg_sync_dependent_to_patients
  AFTER INSERT OR UPDATE OF is_active, pending_approval, cpf, birth_date, phone, name ON public.patient_dependents
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_dependent_to_patients();

CREATE OR REPLACE FUNCTION public.request_dependent_inclusion(
  p_patient_id uuid,
  p_clinic_id uuid,
  p_name text,
  p_cpf text,
  p_birth_date date,
  p_phone text,
  p_relationship text,
  p_cpf_photo_url text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dependent_id uuid;
  v_age integer;
  v_requester_phone text;
  v_clean_cpf text;
BEGIN
  v_clean_cpf := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');

  IF p_patient_id IS NULL OR p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Dados do associado inválidos. Faça login novamente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.patients
    WHERE id = p_patient_id
      AND clinic_id = p_clinic_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Associado não encontrado ou inativo. Faça login novamente.';
  END IF;

  IF length(v_clean_cpf) <> 11 THEN
    RAISE EXCEPTION 'CPF inválido.';
  END IF;

  IF p_relationship = 'child' THEN
    v_age := DATE_PART('year', AGE(CURRENT_DATE, p_birth_date));
    IF v_age > 21 THEN
      RAISE EXCEPTION 'Filhos devem ter até 21 anos de idade';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.patient_dependents
    WHERE clinic_id = p_clinic_id
      AND regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = v_clean_cpf
      AND COALESCE(is_active, false) = true
  ) THEN
    RAISE EXCEPTION 'CPF já cadastrado como dependente nesta clínica';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.patient_dependents pd
    JOIN public.pending_dependent_approvals pda ON pda.dependent_id = pd.id
    WHERE pd.clinic_id = p_clinic_id
      AND regexp_replace(COALESCE(pd.cpf, ''), '\D', '', 'g') = v_clean_cpf
      AND pda.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Já existe uma solicitação pendente para este CPF.';
  END IF;

  SELECT phone INTO v_requester_phone
  FROM public.patients
  WHERE id = p_patient_id;

  INSERT INTO public.patient_dependents (
    clinic_id,
    patient_id,
    name,
    cpf,
    birth_date,
    phone,
    relationship,
    cpf_photo_url,
    is_active,
    pending_approval
  )
  VALUES (
    p_clinic_id,
    p_patient_id,
    trim(p_name),
    v_clean_cpf,
    p_birth_date,
    regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'),
    p_relationship,
    p_cpf_photo_url,
    false,
    true
  )
  RETURNING id INTO v_dependent_id;

  INSERT INTO public.pending_dependent_approvals (
    clinic_id,
    patient_id,
    dependent_id,
    requester_phone,
    cpf_photo_url,
    status
  )
  VALUES (
    p_clinic_id,
    p_patient_id,
    v_dependent_id,
    COALESCE(v_requester_phone, regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), ''),
    p_cpf_photo_url,
    'pending'
  );

  RETURN v_dependent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_dependent_inclusion(uuid, uuid, text, text, date, text, text, text) TO anon, authenticated;