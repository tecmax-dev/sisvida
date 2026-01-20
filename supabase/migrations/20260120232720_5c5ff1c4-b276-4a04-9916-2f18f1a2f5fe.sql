-- 1. Atualiza todas as contribuições vencidas que estão com status incorreto
UPDATE public.employer_contributions
SET status = 'overdue', updated_at = now()
WHERE status = 'pending'
  AND due_date < CURRENT_DATE
  AND negotiation_id IS NULL;

-- 2. Cria função para verificar e atualizar status de contribuições vencidas
CREATE OR REPLACE FUNCTION public.update_overdue_contributions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.employer_contributions
  SET status = 'overdue', updated_at = now()
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE
    AND negotiation_id IS NULL;
END;
$$;

-- 3. Cria trigger function para verificar status na inserção/atualização
CREATE OR REPLACE FUNCTION public.check_contribution_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se a contribuição está sendo inserida/atualizada como pending mas já venceu, marca como overdue
  IF NEW.status = 'pending' AND NEW.due_date < CURRENT_DATE AND NEW.negotiation_id IS NULL THEN
    NEW.status := 'overdue';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Remove trigger existente se houver
DROP TRIGGER IF EXISTS trigger_check_contribution_status ON public.employer_contributions;

-- 5. Cria trigger para verificar status automaticamente
CREATE TRIGGER trigger_check_contribution_status
  BEFORE INSERT OR UPDATE ON public.employer_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_contribution_status();