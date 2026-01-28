-- Função para definir senha do paciente diretamente (primeiro acesso via data de nascimento)
CREATE OR REPLACE FUNCTION public.set_patient_password_direct(p_patient_id uuid, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  -- Validar senha mínima
  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'Senha deve ter no mínimo 6 caracteres';
  END IF;
  
  -- Verificar se paciente existe e ainda não tem senha
  IF NOT EXISTS (
    SELECT 1 FROM public.patients 
    WHERE id = p_patient_id 
    AND password_hash IS NULL
  ) THEN
    RAISE EXCEPTION 'Paciente não encontrado ou já possui senha cadastrada';
  END IF;
  
  -- Definir a senha
  UPDATE public.patients
  SET password_hash = crypt(p_password, gen_salt('bf'))
  WHERE id = p_patient_id
  AND password_hash IS NULL;
  
  RETURN true;
END;
$$;