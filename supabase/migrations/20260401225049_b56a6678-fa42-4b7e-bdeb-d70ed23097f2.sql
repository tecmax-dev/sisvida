
-- Add birth_year column to patient_password_resets for identity verification
ALTER TABLE public.patient_password_resets ADD COLUMN IF NOT EXISTS birth_year integer;

-- Update reset_patient_password_with_token to require birth year verification
CREATE OR REPLACE FUNCTION public.reset_patient_password_with_token(
  p_email text,
  p_token text,
  p_new_password text,
  p_birth_year integer DEFAULT NULL
)
RETURNS TABLE(
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_patient_id uuid;
  v_reset_id uuid;
  v_expected_birth_year integer;
BEGIN
  IF LENGTH(p_new_password) < 6 THEN
    RETURN QUERY SELECT false, 'A senha deve ter no mínimo 6 caracteres'::text;
    RETURN;
  END IF;

  SELECT id INTO v_patient_id
  FROM public.patients
  WHERE LOWER(email) = LOWER(p_email)
    AND is_active = true
  LIMIT 1;
  
  IF v_patient_id IS NULL THEN
    RETURN QUERY SELECT false, 'Email não encontrado'::text;
    RETURN;
  END IF;
  
  SELECT id, birth_year INTO v_reset_id, v_expected_birth_year
  FROM public.patient_password_resets
  WHERE patient_id = v_patient_id
    AND token = p_token
    AND expires_at > now()
    AND used_at IS NULL
  LIMIT 1;
  
  IF v_reset_id IS NULL THEN
    RETURN QUERY SELECT false, 'Código inválido ou expirado'::text;
    RETURN;
  END IF;

  -- Verify birth year if it was stored in the reset record
  IF v_expected_birth_year IS NOT NULL THEN
    IF p_birth_year IS NULL OR p_birth_year != v_expected_birth_year THEN
      RETURN QUERY SELECT false, 'Ano de nascimento incorreto'::text;
      RETURN;
    END IF;
  END IF;
  
  UPDATE public.patient_password_resets
  SET used_at = now()
  WHERE id = v_reset_id;
  
  UPDATE public.patients
  SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = v_patient_id;
  
  RETURN QUERY SELECT true, 'Senha redefinida com sucesso'::text;
END;
$$;
