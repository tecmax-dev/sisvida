-- Adicionar coluna negotiation_id para vincular o preview à negociação original
ALTER TABLE public.negotiation_previews
ADD COLUMN IF NOT EXISTS negotiation_id uuid REFERENCES public.debt_negotiations(id) ON DELETE SET NULL;

-- Criar índice para buscas
CREATE INDEX IF NOT EXISTS idx_negotiation_previews_negotiation_id 
ON public.negotiation_previews(negotiation_id);