-- Adicionar coluna para tamanho de papel (A4 ou A5)
ALTER TABLE public.document_settings
ADD COLUMN IF NOT EXISTS paper_size TEXT DEFAULT 'A4' CHECK (paper_size IN ('A4', 'A5'));