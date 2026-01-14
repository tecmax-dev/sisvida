-- Tabela para tokens de recuperação de senha do app mobile
CREATE TABLE IF NOT EXISTS public.patient_password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índice para busca por token
CREATE INDEX IF NOT EXISTS idx_patient_password_resets_token ON public.patient_password_resets(token);

-- Índice para limpeza de tokens expirados
CREATE INDEX IF NOT EXISTS idx_patient_password_resets_expires ON public.patient_password_resets(expires_at);

-- RLS
ALTER TABLE public.patient_password_resets ENABLE ROW LEVEL SECURITY;

-- Política: Apenas funções security definer podem acessar
CREATE POLICY "No direct access to password resets"
ON public.patient_password_resets
FOR ALL
USING (false);

-- Função para criar token de recuperação
CREATE OR REPLACE FUNCTION public.create_password_reset_token(p_email text)
RETURNS TABLE(
  success boolean,
  patient_name text,
  token text,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
  v_patient_name text;
  v_token text;
BEGIN
  -- Busca paciente pelo email
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
  
  -- Invalida tokens anteriores
  UPDATE public.patient_password_resets
  SET used_at = now()
  WHERE patient_id = v_patient_id AND used_at IS NULL;
  
  -- Gera novo token (6 dígitos)
  v_token := LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');
  
  -- Insere novo token (válido por 30 minutos)
  INSERT INTO public.patient_password_resets (patient_id, token, expires_at)
  VALUES (v_patient_id, v_token, now() + interval '30 minutes');
  
  RETURN QUERY SELECT true, v_patient_name, v_token, 'Token criado com sucesso'::text;
END;
$$;

-- Função para validar token e redefinir senha
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
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
  v_reset_id uuid;
BEGIN
  -- Valida tamanho da senha
  IF LENGTH(p_new_password) < 6 THEN
    RETURN QUERY SELECT false, 'A senha deve ter no mínimo 6 caracteres'::text;
    RETURN;
  END IF;

  -- Busca paciente pelo email
  SELECT id INTO v_patient_id
  FROM public.patients
  WHERE LOWER(email) = LOWER(p_email)
    AND is_active = true
  LIMIT 1;
  
  IF v_patient_id IS NULL THEN
    RETURN QUERY SELECT false, 'Email não encontrado'::text;
    RETURN;
  END IF;
  
  -- Valida token
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
  
  -- Marca token como usado
  UPDATE public.patient_password_resets
  SET used_at = now()
  WHERE id = v_reset_id;
  
  -- Atualiza senha
  UPDATE public.patients
  SET password_hash = crypt(p_new_password, gen_salt('bf'))
  WHERE id = v_patient_id;
  
  RETURN QUERY SELECT true, 'Senha alterada com sucesso'::text;
END;
$$;