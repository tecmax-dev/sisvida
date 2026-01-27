-- Fix race condition in negotiation code generation
-- Use MAX of existing codes instead of COUNT to prevent duplicates
CREATE OR REPLACE FUNCTION public.generate_negotiation_code(p_clinic_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year TEXT;
  v_max_seq INTEGER;
  v_code TEXT;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Use MAX instead of COUNT to handle gaps and deleted records
  SELECT COALESCE(MAX(
    CASE 
      WHEN negotiation_code ~ ('^NEG-' || v_year || '-\d+$') 
      THEN CAST(split_part(negotiation_code, '-', 3) AS integer)
      ELSE 0
    END
  ), 0) + 1
  INTO v_max_seq
  FROM public.debt_negotiations
  WHERE clinic_id = p_clinic_id;
  
  v_code := 'NEG-' || v_year || '-' || LPAD(v_max_seq::TEXT, 5, '0');
  
  RETURN v_code;
END;
$function$;