
-- RPC to fetch dependent approval requests for a patient (mobile app - bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_patient_dependent_requests(p_patient_id uuid)
RETURNS TABLE(
  id uuid,
  dependent_id uuid,
  dependent_name text,
  dependent_cpf text,
  dependent_relationship text,
  status text,
  rejection_reason text,
  created_at timestamptz,
  reviewed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    pda.id,
    pda.dependent_id,
    pd.name AS dependent_name,
    pd.cpf AS dependent_cpf,
    pd.relationship AS dependent_relationship,
    pda.status,
    pda.rejection_reason,
    pda.created_at,
    pda.reviewed_at
  FROM pending_dependent_approvals pda
  JOIN patient_dependents pd ON pd.id = pda.dependent_id
  WHERE pda.patient_id = p_patient_id
  ORDER BY pda.created_at DESC;
END;
$function$;
