CREATE OR REPLACE FUNCTION public.validate_union_check_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  normalized_check text;
BEGIN
  -- Só valida se o método de pagamento for cheque
  IF NEW.payment_method = 'check' THEN
    -- Allow null check_number for recurring entries (will be filled on reconciliation)
    IF NEW.recurrence_type IS NOT NULL AND (NEW.check_number IS NULL OR trim(NEW.check_number) = '') THEN
      RETURN NEW;
    END IF;
    
    -- Cheque é obrigatório
    IF NEW.check_number IS NULL OR trim(NEW.check_number) = '' THEN
      RAISE EXCEPTION 'Número do cheque é obrigatório para pagamentos em cheque';
    END IF;
    
    -- Normalizar número do cheque
    normalized_check := normalize_check_number(NEW.check_number);
    
    -- Validar se contém apenas números
    IF normalized_check IS NULL OR normalized_check = '' THEN
      RAISE EXCEPTION 'Número do cheque deve conter apenas números';
    END IF;
    
    -- Atualizar com valor normalizado
    NEW.check_number := normalized_check;
  END IF;
  
  RETURN NEW;
END;
$function$;