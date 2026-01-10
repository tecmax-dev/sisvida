-- Adicionar coluna para identificar débitos negociados (código 99)
ALTER TABLE public.employer_contributions 
ADD COLUMN IF NOT EXISTS is_negotiated_debt BOOLEAN DEFAULT FALSE;

-- Remover a coluna gerada existente
ALTER TABLE public.employer_contributions 
DROP COLUMN IF EXISTS active_competence_key;

-- Recriar a coluna gerada incluindo o indicador de débito negociado
ALTER TABLE public.employer_contributions 
ADD COLUMN active_competence_key TEXT GENERATED ALWAYS AS (
  CASE
    WHEN status <> 'cancelled' THEN
      employer_id::text || ':' || contribution_type_id::text || ':' || 
      competence_year::text || ':' || competence_month::text ||
      CASE WHEN is_negotiated_debt = TRUE THEN '-DN' ELSE '' END
    ELSE NULL
  END
) STORED;

-- Recriar o índice único para a chave de competência ativa
DROP INDEX IF EXISTS idx_employer_contributions_active_key;
CREATE UNIQUE INDEX idx_employer_contributions_active_key 
ON public.employer_contributions (active_competence_key) 
WHERE active_competence_key IS NOT NULL;