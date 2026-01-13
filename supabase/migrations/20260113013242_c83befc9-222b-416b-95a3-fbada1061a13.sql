
-- ==================================================================
-- SISTEMA DE CONCILIAÇÃO BANCÁRIA COM OFX + CONTROLE DE CHEQUES
-- PARTE 2: Adicionando funcionalidades restantes sem constraint única
-- ==================================================================

-- 7. FUNÇÃO PARA NORMALIZAR NÚMERO DE CHEQUE (se não existir)
CREATE OR REPLACE FUNCTION public.normalize_check_number(check_num text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF check_num IS NULL OR check_num = '' THEN
    RETURN NULL;
  END IF;
  -- Remove espaços, mantém apenas números
  RETURN regexp_replace(trim(check_num), '[^0-9]', '', 'g');
END;
$$;

-- 8. FUNÇÃO PARA VALIDAR CHEQUE ANTES DE INSERT/UPDATE (sem verificar duplicidade, pois um cheque pode pagar múltiplas despesas)
CREATE OR REPLACE FUNCTION public.validate_union_check_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_check text;
BEGIN
  -- Só valida se o método de pagamento for cheque
  IF NEW.payment_method = 'check' THEN
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
$$;

-- 9. TRIGGER PARA VALIDAR CHEQUE
DROP TRIGGER IF EXISTS trigger_validate_union_check_number ON public.union_financial_transactions;
CREATE TRIGGER trigger_validate_union_check_number
  BEFORE INSERT OR UPDATE ON public.union_financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_union_check_number();

-- 10. FUNÇÃO PARA BLOQUEAR EDIÇÃO DE TRANSAÇÃO CONCILIADA
CREATE OR REPLACE FUNCTION public.protect_reconciled_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bloquear edição se já conciliada
  IF OLD.is_conciliated = true THEN
    -- Permitir apenas atualização de campos não-financeiros ou estorno
    IF OLD.check_number IS DISTINCT FROM NEW.check_number 
       OR OLD.amount IS DISTINCT FROM NEW.amount
       OR OLD.cash_register_id IS DISTINCT FROM NEW.cash_register_id
       OR OLD.gross_value IS DISTINCT FROM NEW.gross_value
       OR OLD.net_value IS DISTINCT FROM NEW.net_value THEN
      -- Verificar se é um estorno válido
      IF NEW.status = 'reversed' AND NEW.reversal_reason IS NOT NULL AND NEW.reversal_reason != '' THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Não é permitido alterar número do cheque, valor ou conta bancária de transação conciliada. Use o estorno.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 11. TRIGGER PARA PROTEGER TRANSAÇÃO CONCILIADA
DROP TRIGGER IF EXISTS trigger_protect_reconciled_transaction ON public.union_financial_transactions;
CREATE TRIGGER trigger_protect_reconciled_transaction
  BEFORE UPDATE ON public.union_financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_reconciled_transaction();

-- 12. FUNÇÃO PARA LOG DE AUDITORIA DE CONCILIAÇÃO
CREATE OR REPLACE FUNCTION public.log_reconciliation_action(
  p_clinic_id uuid,
  p_transaction_id uuid,
  p_statement_transaction_id uuid,
  p_action text,
  p_origin text,
  p_previous_status text,
  p_new_status text,
  p_details jsonb,
  p_performed_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO union_reconciliation_audit_logs (
    clinic_id, transaction_id, statement_transaction_id, 
    action, origin, previous_status, new_status, 
    details, performed_by
  )
  VALUES (
    p_clinic_id, p_transaction_id, p_statement_transaction_id,
    p_action, p_origin, p_previous_status, p_new_status,
    p_details, p_performed_by
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;
