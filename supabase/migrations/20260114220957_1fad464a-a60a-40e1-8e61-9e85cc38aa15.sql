
-- Função RPC para buscar dependentes de um paciente (usado pelo app mobile)
CREATE OR REPLACE FUNCTION public.get_patient_dependents(p_patient_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  cpf text,
  birth_date date,
  relationship text,
  phone text,
  is_active boolean,
  card_number text,
  card_expires_at timestamp with time zone,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pd.id,
    pd.name,
    pd.cpf,
    pd.birth_date,
    pd.relationship,
    pd.phone,
    pd.is_active,
    pd.card_number,
    pd.card_expires_at,
    pd.created_at
  FROM patient_dependents pd
  WHERE pd.patient_id = p_patient_id
    AND pd.is_active = true
  ORDER BY pd.name;
END;
$$;

-- Permitir que qualquer usuário autenticado ou anônimo chame a função
GRANT EXECUTE ON FUNCTION public.get_patient_dependents(uuid) TO anon, authenticated;
