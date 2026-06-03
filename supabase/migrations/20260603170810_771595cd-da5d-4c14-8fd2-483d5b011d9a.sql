-- RPC: reset patient password by CPF + 6-digit code (PWA / sindicato)
-- Removes the need to expose patient e-mail to the public client.
CREATE OR REPLACE FUNCTION public.reset_patient_password_by_cpf_code(
  p_cpf text,
  p_code text,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cpf_digits text;
  v_patient_id uuid;
  v_reset_id uuid;
BEGIN
  IF p_cpf IS NULL OR p_code IS NULL OR p_new_password IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dados obrigatórios ausentes');
  END IF;

  IF length(p_new_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'message', 'A senha deve ter no mínimo 6 caracteres');
  END IF;

  v_cpf_digits := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  IF length(v_cpf_digits) <> 11 THEN
    RETURN jsonb_build_object('success', false, 'message', 'CPF inválido');
  END IF;

  SELECT pr.id, pr.patient_id
    INTO v_reset_id, v_patient_id
  FROM public.patient_password_resets pr
  JOIN public.patients p ON p.id = pr.patient_id
  WHERE regexp_replace(coalesce(p.cpf, ''), '[^0-9]', '', 'g') = v_cpf_digits
    AND p.is_active = true
    AND pr.token = p_code
    AND pr.used_at IS NULL
    AND pr.expires_at > now()
  ORDER BY pr.created_at DESC
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

GRANT EXECUTE ON FUNCTION public.reset_patient_password_by_cpf_code(text, text, text) TO anon, authenticated;