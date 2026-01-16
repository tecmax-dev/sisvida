-- Adicionar campo de configuração para ocultar pendências antigas
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS hide_pending_before_date DATE DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.clinics.hide_pending_before_date IS 'Data limite para ocultar contribuições pendentes/vencidas anteriores a esta data. Usado para evitar exibição de débitos em processo de conciliação.';