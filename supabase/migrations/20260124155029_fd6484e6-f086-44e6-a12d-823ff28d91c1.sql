
-- Atualizar a função complete_first_access para usar a tabela correta: first_access_tokens
CREATE OR REPLACE FUNCTION public.complete_first_access(p_token text, p_email text, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_token_record record;
BEGIN
  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'Senha deve ter no mínimo 6 caracteres';
  END IF;

  -- Buscar token na tabela correta: first_access_tokens
  SELECT * INTO v_token_record
  FROM public.first_access_tokens
  WHERE token = p_token
    AND lower(trim(email)) = lower(trim(p_email))
    AND used_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_token_record IS NULL THEN
    RETURN false;
  END IF;
  
  -- Marcar token como usado
  UPDATE public.first_access_tokens
  SET used_at = now()
  WHERE id = v_token_record.id;
  
  -- Atualizar senha do paciente
  UPDATE public.patients
  SET password_hash = crypt(p_password, gen_salt('bf'))
  WHERE id = v_token_record.patient_id;
  
  RETURN true;
END;
$$;
