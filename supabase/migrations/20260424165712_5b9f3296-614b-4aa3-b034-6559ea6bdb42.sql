-- Função pública para localizar associado no fluxo de Primeiro Acesso
-- A página roda sem autenticação; RLS da tabela patients bloqueia acesso anônimo.
CREATE OR REPLACE FUNCTION public.find_patient_for_first_access(p_cpf text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_normalized text;
  v_patient record;
  v_sindicato_clinic uuid := '89e7585e-7bce-4e58-91fa-c37080d1170d'::uuid;
BEGIN
  v_normalized := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');

  IF length(v_normalized) <> 11 THEN
    RETURN jsonb_build_object('found', false, 'reason', 'invalid_cpf');
  END IF;

  SELECT id, name, birth_date, password_hash IS NOT NULL AS has_password, is_active
  INTO v_patient
  FROM public.patients
  WHERE clinic_id = v_sindicato_clinic
    AND regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = v_normalized
  ORDER BY is_active DESC NULLS LAST, created_at ASC
  LIMIT 1;

  IF v_patient.id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'reason', 'not_found');
  END IF;

  IF v_patient.is_active IS NOT TRUE THEN
    RETURN jsonb_build_object('found', false, 'reason', 'inactive');
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'id', v_patient.id,
    'name', v_patient.name,
    'birth_date', v_patient.birth_date,
    'has_password', v_patient.has_password,
    'has_birth_date', v_patient.birth_date IS NOT NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_patient_for_first_access(text) TO anon, authenticated;