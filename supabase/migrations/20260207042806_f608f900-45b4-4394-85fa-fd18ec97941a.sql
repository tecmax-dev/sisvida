
-- Create function to generate unique matricula for sindical_associados
CREATE OR REPLACE FUNCTION public.generate_associado_matricula(p_sindicato_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_year TEXT;
  v_max_seq INTEGER;
  v_matricula TEXT;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Get the max sequence number for this sindicato in the current year
  SELECT COALESCE(MAX(
    CASE 
      WHEN matricula ~ ('^' || v_year || '\d{6}$') 
      THEN CAST(SUBSTRING(matricula FROM 5) AS integer)
      ELSE 0
    END
  ), 0) + 1
  INTO v_max_seq
  FROM public.sindical_associados
  WHERE sindicato_id = p_sindicato_id
  AND matricula IS NOT NULL;
  
  -- Format: YYYY + 6-digit sequence (e.g., 2026000001)
  v_matricula := v_year || LPAD(v_max_seq::TEXT, 6, '0');
  
  RETURN v_matricula;
END;
$function$;

-- Create trigger function to auto-generate matricula on insert
CREATE OR REPLACE FUNCTION public.auto_generate_associado_matricula()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only generate if matricula is null and sindicato_id exists
  IF NEW.matricula IS NULL AND NEW.sindicato_id IS NOT NULL THEN
    NEW.matricula := public.generate_associado_matricula(NEW.sindicato_id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for auto-generation on INSERT
DROP TRIGGER IF EXISTS trigger_auto_generate_matricula ON public.sindical_associados;
CREATE TRIGGER trigger_auto_generate_matricula
  BEFORE INSERT ON public.sindical_associados
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_associado_matricula();

-- Backfill existing records without matricula
UPDATE public.sindical_associados sa
SET matricula = public.generate_associado_matricula(sa.sindicato_id)
WHERE sa.matricula IS NULL
AND sa.sindicato_id IS NOT NULL;
