
-- Trigger para cancelar automaticamente payslip_requests pendentes quando a carteirinha é renovada
-- (quando expires_at é atualizado para uma data futura)

CREATE OR REPLACE FUNCTION public.auto_resolve_payslip_on_card_renewal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se a data de expiração foi alterada para uma data futura
  IF NEW.expires_at IS NOT NULL 
     AND OLD.expires_at IS DISTINCT FROM NEW.expires_at 
     AND NEW.expires_at > now() 
  THEN
    -- Atualizar payslip_requests pendentes para esse cartão como "rejected" (resolvido)
    UPDATE public.payslip_requests
    SET 
      status = 'rejected',
      notes = COALESCE(notes || E'\n', '') || 'Auto-resolvido: carteirinha renovada em ' || to_char(now(), 'DD/MM/YYYY'),
      reviewed_at = now(),
      updated_at = now()
    WHERE card_id = NEW.id
      AND status IN ('pending', 'received');
    
    -- Log se houve atualização
    IF FOUND THEN
      RAISE NOTICE 'Auto-resolved payslip requests for card %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger na tabela patient_cards
DROP TRIGGER IF EXISTS trigger_auto_resolve_payslip_on_card_renewal ON public.patient_cards;

CREATE TRIGGER trigger_auto_resolve_payslip_on_card_renewal
  AFTER UPDATE OF expires_at ON public.patient_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_resolve_payslip_on_card_renewal();

-- Comentário para documentação
COMMENT ON FUNCTION public.auto_resolve_payslip_on_card_renewal() IS 'Automatically resolves pending payslip requests when a patient card is renewed (expires_at updated to future date)';
