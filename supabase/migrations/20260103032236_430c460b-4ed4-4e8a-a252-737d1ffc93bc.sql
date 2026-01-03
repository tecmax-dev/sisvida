
-- Atualizar trigger para comparar CPF normalizado (sem formatação)
CREATE OR REPLACE FUNCTION public.check_cpf_duplicate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  clean_new_cpf TEXT;
BEGIN
  IF NEW.cpf IS NOT NULL AND NEW.cpf <> '' THEN
    -- Normalizar CPF removendo todos os caracteres não numéricos
    clean_new_cpf := regexp_replace(NEW.cpf, '[^0-9]', '', 'g');
    
    IF EXISTS (
      SELECT 1 FROM patients 
      WHERE clinic_id = NEW.clinic_id 
      AND regexp_replace(cpf, '[^0-9]', '', 'g') = clean_new_cpf
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'CPF_DUPLICADO: Este CPF já está cadastrado no sistema.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
