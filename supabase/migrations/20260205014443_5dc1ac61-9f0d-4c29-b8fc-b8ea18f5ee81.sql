-- Adicionar campo CPF do responsável para clínicas PF
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS owner_cpf TEXT,
ADD COLUMN IF NOT EXISTS owner_name TEXT;

-- Criar índice para busca por CPF
CREATE INDEX IF NOT EXISTS idx_clinics_owner_cpf ON public.clinics(owner_cpf) WHERE owner_cpf IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.clinics.owner_cpf IS 'CPF do responsável para clínicas pessoa física (sem CNPJ)';
COMMENT ON COLUMN public.clinics.owner_name IS 'Nome do responsável para faturamento PF';