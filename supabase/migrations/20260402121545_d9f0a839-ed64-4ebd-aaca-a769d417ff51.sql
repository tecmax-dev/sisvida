
CREATE OR REPLACE FUNCTION public.reset_patient_password_by_birth_year(
  p_email text,
  p_birth_year integer,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_patient record;
  v_hashed text;
BEGIN
  SELECT id, name, birth_date, password_hash
  INTO v_patient
  FROM patients
  WHERE email = lower(trim(p_email))
    AND is_active = true
  LIMIT 1;

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dados não conferem. Verifique o email e tente novamente.');
  END IF;

  IF v_patient.password_hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Esta conta ainda não possui senha. Use a opção de primeiro acesso.');
  END IF;

  IF v_patient.birth_date IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dados cadastrais incompletos. Entre em contato com o sindicato.');
  END IF;

  IF extract(year FROM v_patient.birth_date)::integer <> p_birth_year THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ano de nascimento não confere.');
  END IF;

  v_hashed := crypt(p_new_password, gen_salt('bf'));

  UPDATE patients
  SET password_hash = v_hashed,
      updated_at = now()
  WHERE id = v_patient.id;

  RETURN jsonb_build_object('success', true, 'message', 'Senha redefinida com sucesso.');
END;
$$;
