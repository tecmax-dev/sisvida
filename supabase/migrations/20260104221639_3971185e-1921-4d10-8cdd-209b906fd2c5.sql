-- Adicionar coluna CEP na tabela employers
ALTER TABLE public.employers ADD COLUMN IF NOT EXISTS cep TEXT;

-- Adicionar coluna bairro na tabela employers
ALTER TABLE public.employers ADD COLUMN IF NOT EXISTS neighborhood TEXT;