-- Função para verificar se paciente existe sem senha e retornar dados para primeiro acesso
CREATE OR REPLACE FUNCTION public.check_patient_first_access(p_cpf text, p_email text)
RETURNS TABLE(patient_id uuid, patient_name text, patient_email text, clinic_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_normalized_cpf text;
  v_normalized_email text;
BEGIN
  -- Normaliza CPF removendo pontos e traços
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

-- Tabela para armazenar tokens de primeiro acesso
CREATE TABLE IF NOT EXISTS public.patient_first_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  token text NOT NULL,
  email text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para busca por token
CREATE INDEX IF NOT EXISTS idx_patient_first_access_tokens_token ON public.patient_first_access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_patient_first_access_tokens_patient ON public.patient_first_access_tokens(patient_id);

-- RLS
ALTER TABLE public.patient_first_access_tokens ENABLE ROW LEVEL SECURITY;

-- Política para permitir operações via service role (edge functions)
CREATE POLICY "Service role can manage first access tokens"
ON public.patient_first_access_tokens
FOR ALL
USING (true)
WITH CHECK (true);

-- Função para criar token de primeiro acesso
CREATE OR REPLACE FUNCTION public.create_first_access_token(p_patient_id uuid, p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_token text;
BEGIN
  -- Invalida tokens anteriores do mesmo paciente
  UPDATE public.patient_first_access_tokens
  SET used_at = now()
  WHERE patient_id = p_patient_id AND used_at IS NULL;
  
  -- Gera token de 6 dígitos
  v_token := lpad(floor(random() * 1000000)::text, 6, '0');
  
  -- Insere novo token
  INSERT INTO public.patient_first_access_tokens (patient_id, token, email)
  VALUES (p_patient_id, v_token, p_email);
  
  RETURN v_token;
END;
$$;

-- Função para validar token e definir senha no primeiro acesso
CREATE OR REPLACE FUNCTION public.complete_first_access(p_token text, p_email text, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_token_record record;
BEGIN
  -- Valida tamanho mínimo da senha
  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'Senha deve ter no mínimo 6 caracteres';
  END IF;

  -- Busca token válido
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
  
  -- Marca token como usado
  UPDATE public.patient_first_access_tokens
  SET used_at = now()
  WHERE id = v_token_record.id;
  
  -- Define a senha do paciente
  UPDATE public.patients
  SET password_hash = crypt(p_password, gen_salt('bf'))
  WHERE id = v_token_record.patient_id;
  
  RETURN true;
END;
$$;