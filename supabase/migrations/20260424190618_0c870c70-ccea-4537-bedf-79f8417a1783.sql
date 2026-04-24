CREATE OR REPLACE FUNCTION public.reset_patient_password_by_code(
  p_email text,
  p_code text,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_patient_id uuid;
  v_reset_id uuid;
BEGIN
  IF p_email IS NULL OR p_code IS NULL OR p_new_password IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dados obrigatórios ausentes');
  END IF;

  IF length(p_new_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'message', 'A senha deve ter no mínimo 6 caracteres');
  END IF;

  SELECT id INTO v_patient_id
  FROM public.patients
  WHERE lower(email) = lower(p_email)
    AND is_active = true
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Código inválido ou expirado');
  END IF;

  SELECT id INTO v_reset_id
  FROM public.patient_password_resets
  WHERE patient_id = v_patient_id
    AND token = p_code
    AND used_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_reset_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Código inválido ou expirado');
  END IF;

  UPDATE public.patients
  SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = v_patient_id;

  UPDATE public.patient_password_resets
  SET used_at = now()
  WHERE id = v_reset_id;

  RETURN jsonb_build_object('success', true, 'message', 'Senha redefinida com sucesso');
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_patient_password_by_code(text, text, text) TO anon, authenticated;