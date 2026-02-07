-- Criar trigger para verificar status ao inserir/atualizar contribuições
CREATE TRIGGER check_contribution_status_trigger
  BEFORE INSERT OR UPDATE ON public.employer_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_contribution_status();

-- Comentário explicativo
COMMENT ON TRIGGER check_contribution_status_trigger ON public.employer_contributions 
  IS 'Atualiza automaticamente status de pending para overdue quando due_date < CURRENT_DATE';