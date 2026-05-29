ALTER TABLE public.homologacao_blocks
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME;

CREATE INDEX IF NOT EXISTS idx_homologacao_blocks_slot
  ON public.homologacao_blocks (clinic_id, block_date, professional_id, start_time);

COMMENT ON COLUMN public.homologacao_blocks.start_time IS 'Horário inicial do bloqueio (NULL = dia inteiro)';
COMMENT ON COLUMN public.homologacao_blocks.end_time IS 'Horário final do bloqueio (NULL = dia inteiro)';