
-- Modificar a coluna gerada para incluir um sufixo de sequência quando duplicatas são permitidas
-- Primeiro precisamos dropar e recriar a coluna gerada

-- Step 1: Drop the unique index first
DROP INDEX IF EXISTS idx_employer_contributions_active_key;

-- Step 2: Drop the generated column
ALTER TABLE public.employer_contributions DROP COLUMN IF EXISTS active_competence_key;

-- Step 3: Recreate the column with a new formula that includes the id to allow duplicates
-- Quando permitir duplicatas, adicionar o id no final para garantir unicidade
ALTER TABLE public.employer_contributions 
ADD COLUMN active_competence_key TEXT GENERATED ALWAYS AS (
  CASE
    WHEN status <> 'cancelled' THEN 
      employer_id || ':' || 
      contribution_type_id || ':' || 
      competence_year || ':' || 
      competence_month ||
      CASE WHEN is_negotiated_debt = true THEN '-DN' ELSE '' END ||
      ':' || id  -- Adicionar ID para permitir múltiplas contribuições iguais
    ELSE NULL
  END
) STORED;

-- Step 4: Recreate the unique index
CREATE UNIQUE INDEX idx_employer_contributions_active_key 
ON public.employer_contributions (active_competence_key);

-- Comentário explicativo
COMMENT ON COLUMN public.employer_contributions.active_competence_key IS 'Chave de competência única. Inclui ID para permitir duplicatas quando configurado.';
