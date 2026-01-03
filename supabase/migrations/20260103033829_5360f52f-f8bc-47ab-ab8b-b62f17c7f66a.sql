-- Adicionar coluna para URL da imagem nas campanhas
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Comentário para documentação
COMMENT ON COLUMN public.campaigns.image_url IS 'URL da imagem para envio junto com a mensagem da campanha (WhatsApp)';
