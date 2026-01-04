-- Adicionar campo CNPJ na tabela de escritórios
ALTER TABLE public.accounting_offices
ADD COLUMN cnpj TEXT,
ADD COLUMN trade_name TEXT,
ADD COLUMN address TEXT,
ADD COLUMN city TEXT,
ADD COLUMN state TEXT;

-- Índice para busca por CNPJ
CREATE INDEX accounting_offices_cnpj_idx ON public.accounting_offices(cnpj);