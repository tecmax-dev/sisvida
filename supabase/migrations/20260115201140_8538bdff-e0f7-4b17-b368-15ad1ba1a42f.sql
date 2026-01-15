-- Adicionar coluna para token público de acesso direto
ALTER TABLE public.employer_contributions 
ADD COLUMN IF NOT EXISTS public_access_token TEXT UNIQUE;

-- Criar índice para busca rápida por token
CREATE INDEX IF NOT EXISTS idx_employer_contributions_public_token 
ON public.employer_contributions(public_access_token) 
WHERE public_access_token IS NOT NULL;

-- Função para gerar token seguro
CREATE OR REPLACE FUNCTION generate_contribution_access_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN encode(gen_random_bytes(24), 'base64');
END;
$$;