-- CRITICAL: Update get_patient_dependents to filter out pending approval dependents
-- This ensures dependents awaiting approval cannot be used for booking

CREATE OR REPLACE FUNCTION public.get_patient_dependents(p_patient_id uuid)
 RETURNS TABLE(id uuid, name text, cpf text, birth_date date, relationship text, phone text, is_active boolean, card_number text, card_expires_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND (pd.pending_approval IS NULL OR pd.pending_approval = false)
  ORDER BY pd.name;
END;
$function$;