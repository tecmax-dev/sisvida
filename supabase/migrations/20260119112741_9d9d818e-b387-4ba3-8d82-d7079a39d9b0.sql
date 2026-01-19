-- Função para verificar se um CPF pode cancelar o agendamento
-- Usada pela RLS para permitir que associados cancelem seus próprios agendamentos via app
CREATE OR REPLACE FUNCTION public.can_mobile_cancel_homologacao(p_appointment_id uuid, p_employee_cpf text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored_cpf text;
  v_normalized_param text;
  v_normalized_stored text;
BEGIN
  -- Normaliza o CPF recebido (remove pontuação)
  v_normalized_param := regexp_replace(COALESCE(p_employee_cpf, ''), '[^0-9]', '', 'g');
  
  -- Busca o CPF do agendamento
  SELECT employee_cpf INTO v_stored_cpf
  FROM public.homologacao_appointments
  WHERE id = p_appointment_id;
  
  IF v_stored_cpf IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Normaliza o CPF armazenado
  v_normalized_stored := regexp_replace(v_stored_cpf, '[^0-9]', '', 'g');
  
  -- Compara os CPFs normalizados
  RETURN v_normalized_param = v_normalized_stored AND length(v_normalized_param) = 11;
END;
$$;

-- Atualiza a política de cancelamento para usar employee_cpf como critério
-- Drop da política antiga
DROP POLICY IF EXISTS "allow_cancel_scheduled_appointments" ON public.homologacao_appointments;

-- Nova política: permite cancelar se o status é scheduled/confirmed E 
-- (tem acesso via has_union_homologacao_access OU o CPF bate com employee_cpf)
CREATE POLICY "allow_cancel_scheduled_appointments"
ON public.homologacao_appointments
FOR UPDATE
TO anon, authenticated
USING (
  status IN ('scheduled', 'confirmed')
)
WITH CHECK (
  status = 'cancelled'
);

-- Comentário explicativo
COMMENT ON FUNCTION public.can_mobile_cancel_homologacao IS 
'Valida se um CPF pode cancelar um agendamento de homologação. Usado pelo app móvel para permitir que associados cancelem seus próprios agendamentos.';