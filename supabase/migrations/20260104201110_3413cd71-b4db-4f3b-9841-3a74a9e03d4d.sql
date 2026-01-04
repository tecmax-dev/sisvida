-- Adicionar coluna para rastrear quantidade de reemissões de boleto via portal
ALTER TABLE public.employer_contributions 
ADD COLUMN portal_reissue_count integer NOT NULL DEFAULT 0;

-- Comentário explicativo
COMMENT ON COLUMN public.employer_contributions.portal_reissue_count IS 'Contador de reemissões de boleto solicitadas via portais (empresa/contador). Limite de 2 reemissões por portal.';