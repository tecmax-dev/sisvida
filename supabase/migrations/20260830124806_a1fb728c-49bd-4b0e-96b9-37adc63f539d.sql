DROP FUNCTION IF EXISTS public.request_dependent_inclusion(uuid,uuid,text,text,date,text,text,text);

CREATE OR REPLACE FUNCTION public.request_dependent_inclusion(
  p_patient_id uuid,
  p_clinic_id uuid,
  p_name text,
  p_cpf text,
  p_birth_date date,
  p_phone text,
  p_relationship text,
  p_cpf_photo_url text,
  p_gender text DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dependent_id uuid;
  v_age integer;
  v_requester_phone text;
  v_clean_cpf text;
  v_gender text;
BEGIN
  v_clean_cpf := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');
  v_gender := NULLIF(lower(COALESCE(p_gender, '')), '');
  IF v_gender IS NOT NULL AND v_gender NOT IN ('masculino','feminino','outro') THEN
    v_gender := NULL;
  END IF;

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
    clinic_id, patient_id, name, cpf, birth_date, phone, relationship,
    gender, cpf_photo_url, is_active, pending_approval
  )
  VALUES (
    p_clinic_id, p_patient_id, trim(p_name), v_clean_cpf, p_birth_date,
    regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), p_relationship,
    v_gender, p_cpf_photo_url, false, true
  )
  RETURNING id INTO v_dependent_id;

  INSERT INTO public.pending_dependent_approvals (
    clinic_id, patient_id, dependent_id, requester_phone, cpf_photo_url, status
  )
  VALUES (
    p_clinic_id, p_patient_id, v_dependent_id,
    COALESCE(v_requester_phone, regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), ''),
    p_cpf_photo_url, 'pending'
  );

  RETURN v_dependent_id;
END;
$function$;