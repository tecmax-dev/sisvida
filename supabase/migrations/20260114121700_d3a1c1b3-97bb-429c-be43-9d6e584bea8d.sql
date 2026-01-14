-- Adicionar campo de senha hash para pacientes (app mobile)
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS password_hash text;

-- Adicionar índice para busca por CPF (otimização de login)
CREATE INDEX IF NOT EXISTS idx_patients_cpf ON public.patients(cpf) WHERE cpf IS NOT NULL;

-- Função para definir senha do paciente (será chamada pelo admin ao cadastrar)
CREATE OR REPLACE FUNCTION public.set_patient_password(
  p_patient_id uuid,
  p_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.patients 
  SET password_hash = crypt(p_password, gen_salt('bf'))
  WHERE id = p_patient_id;
  
  RETURN FOUND;
END;
$$;

-- Função para verificar senha do paciente (login do app)
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
SET search_path = public
AS $$
DECLARE
  v_normalized_cpf text;
BEGIN
  -- Normaliza CPF removendo pontos e traços
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

-- Habilitar extensão pgcrypto se não existir
CREATE EXTENSION IF NOT EXISTS pgcrypto;