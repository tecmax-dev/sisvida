-- Adicionar coluna legacy_id para armazenar matrícula/ID do escritório
ALTER TABLE public.accounting_offices 
ADD COLUMN IF NOT EXISTS legacy_id TEXT;

-- Comentário para documentação
COMMENT ON COLUMN public.accounting_offices.legacy_id IS 'ID/Matrícula do escritório no sistema legado';