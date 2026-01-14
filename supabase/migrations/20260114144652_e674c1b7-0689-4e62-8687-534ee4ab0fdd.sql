-- Corrige set_patient_password para incluir extensions no search_path
CREATE OR REPLACE FUNCTION public.set_patient_password(
  p_patient_id uuid,
  p_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.patients 
  SET password_hash = crypt(p_password, gen_salt('bf'))
  WHERE id = p_patient_id;
  
  RETURN FOUND;
END;
$$;

-- Corrige verify_patient_password para incluir extensions no search_path
CREATE OR REPLACE FUNCTION public.verify_patient_password(
  p_cpf text,
  p_password text,
  p_clinic_id uuid DEFAULT NULL
)
RETURNS TABLE(
  patient_id uuid,
  patient_name text,
  patient_email text,
  clinic_id uuid,
  is_active boolean,
  no_show_blocked_until date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_normalized_cpf text;
BEGIN
  v_normalized_cpf := regexp_replace(p_cpf, '[^0-9]', '', 'g');
  
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.email,
    p.clinic_id,
    p.is_active,
    p.no_show_blocked_until
  FROM public.patients p
  WHERE regexp_replace(p.cpf, '[^0-9]', '', 'g') = v_normalized_cpf
    AND p.password_hash IS NOT NULL
    AND p.password_hash = crypt(p_password, p.password_hash)
    AND (p_clinic_id IS NULL OR p.clinic_id = p_clinic_id)
  LIMIT 1;
END;
$$;

-- Corrige complete_first_access para incluir extensions no search_path
CREATE OR REPLACE FUNCTION public.complete_first_access(p_token text, p_email text, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token_record record;
BEGIN
  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'Senha deve ter no mínimo 6 caracteres';
  END IF;

  SELECT * INTO v_token_record
  FROM public.patient_first_access_tokens
  WHERE token = p_token
    AND lower(trim(email)) = lower(trim(p_email))
    AND used_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_token_record IS NULL THEN
    RETURN false;
  END IF;
  
  UPDATE public.patient_first_access_tokens
  SET used_at = now()
  WHERE id = v_token_record.id;
  
  UPDATE public.patients
  SET password_hash = crypt(p_password, gen_salt('bf'))
  WHERE id = v_token_record.patient_id;
  
  RETURN true;
END;
$$;

-- Corrige reset_patient_password_with_token para incluir extensions no search_path
CREATE OR REPLACE FUNCTION public.reset_patient_password_with_token(
  p_email text,
  p_token text,
  p_new_password text
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
  
  SELECT id INTO v_reset_id
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
  
  UPDATE public.patient_password_resets
  SET used_at = now()
  WHERE id = v_reset_id;
  
  UPDATE public.patients
  SET password_hash = crypt(p_new_password, gen_salt('bf'))
  WHERE id = v_patient_id;
  
  RETURN QUERY SELECT true, 'Senha alterada com sucesso'::text;
END;
$$;

-- Corrige check_patient_first_access (não usa pgcrypto mas padroniza)
CREATE OR REPLACE FUNCTION public.check_patient_first_access(p_cpf text, p_email text)
RETURNS TABLE(patient_id uuid, patient_name text, patient_email text, clinic_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_normalized_cpf text;
  v_normalized_email text;
BEGIN
  v_normalized_cpf := regexp_replace(p_cpf, '[^0-9]', '', 'g');
  v_normalized_email := lower(trim(p_email));
  
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.email,
    p.clinic_id
  FROM public.patients p
  WHERE regexp_replace(p.cpf, '[^0-9]', '', 'g') = v_normalized_cpf
    AND lower(trim(p.email)) = v_normalized_email
    AND p.password_hash IS NULL
    AND p.is_active = true
  LIMIT 1;
END;
$$;

-- Corrige create_first_access_token (não usa pgcrypto mas padroniza)
CREATE OR REPLACE FUNCTION public.create_first_access_token(p_patient_id uuid, p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token text;
BEGIN
  UPDATE public.patient_first_access_tokens
  SET used_at = now()
  WHERE patient_id = p_patient_id AND used_at IS NULL;
  
  v_token := lpad(floor(random() * 1000000)::text, 6, '0');
  
  INSERT INTO public.patient_first_access_tokens (patient_id, token, email)
  VALUES (p_patient_id, v_token, p_email);
  
  RETURN v_token;
END;
$$;

-- Corrige create_password_reset_token (não usa pgcrypto mas padroniza)
CREATE OR REPLACE FUNCTION public.create_password_reset_token(p_email text)
RETURNS TABLE(
  success boolean,
  patient_name text,
  token text,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_patient_id uuid;
  v_patient_name text;
  v_token text;
BEGIN
  SELECT id, name INTO v_patient_id, v_patient_name
  FROM public.patients
  WHERE LOWER(email) = LOWER(p_email)
    AND is_active = true
    AND password_hash IS NOT NULL
  LIMIT 1;
  
  IF v_patient_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'Email não encontrado ou conta sem senha cadastrada'::text;
    RETURN;
  END IF;
  
  UPDATE public.patient_password_resets
  SET used_at = now()
  WHERE patient_id = v_patient_id AND used_at IS NULL;
  
  v_token := LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');
  
  INSERT INTO public.patient_password_resets (patient_id, token, expires_at)
  VALUES (v_patient_id, v_token, now() + interval '30 minutes');
  
  RETURN QUERY SELECT true, v_patient_name, v_token, 'Token criado com sucesso'::text;
END;
$$;