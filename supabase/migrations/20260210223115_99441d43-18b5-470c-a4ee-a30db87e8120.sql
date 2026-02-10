
-- Fix: request_dependent_inclusion must also insert into pending_dependent_approvals
-- so the approval page can list pending requests.
-- Also: set is_active = false (dependent should be inactive until approved).

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
SET search_path = 'public'
AS $$
DECLARE
  v_dependent_id uuid;
  v_age integer;
  v_requester_phone text;
BEGIN
  -- Validate relationship and age for children
  IF p_relationship = 'child' THEN
    v_age := DATE_PART('year', AGE(CURRENT_DATE, p_birth_date));
    IF v_age > 21 THEN
      RAISE EXCEPTION 'Filhos devem ter até 21 anos de idade';
    END IF;
  END IF;

  -- Check if CPF already exists for this clinic
  IF EXISTS (
    SELECT 1 FROM patient_dependents
    WHERE clinic_id = p_clinic_id
    AND cpf = p_cpf
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'CPF já cadastrado como dependente nesta clínica';
  END IF;

  -- Get requester (titular) phone
  SELECT phone INTO v_requester_phone
  FROM patients
  WHERE id = p_patient_id;

  -- Insert the dependent with pending_approval = true and is_active = false
  INSERT INTO patient_dependents (
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
    p_name,
    p_cpf,
    p_birth_date,
    p_phone,
    p_relationship,
    p_cpf_photo_url,
    false,
    true
  )
  RETURNING id INTO v_dependent_id;

  -- Insert into pending_dependent_approvals for the approval workflow
  INSERT INTO pending_dependent_approvals (
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
    COALESCE(v_requester_phone, p_phone, ''),
    p_cpf_photo_url,
    'pending'
  );

  RETURN v_dependent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_dependent_inclusion TO anon, authenticated;
