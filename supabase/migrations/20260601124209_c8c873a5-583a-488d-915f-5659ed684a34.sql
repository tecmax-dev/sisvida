-- Adicionar contador de alteracoes de valor via portal (empresa/escritorio)
ALTER TABLE public.employer_contributions
  ADD COLUMN IF NOT EXISTS portal_value_change_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.employer_contributions.portal_value_change_count IS
  'Numero de vezes que o valor do boleto foi alterado pelo portal de empresa/escritorio. Limite de 1 alteracao; depois disso somente o gestor (admin) pode alterar.';