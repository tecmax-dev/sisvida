-- Adicionar coluna para controlar navegação para agendamento
ALTER TABLE public.popup_notices 
ADD COLUMN IF NOT EXISTS navigate_to_booking boolean DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN public.popup_notices.navigate_to_booking IS 'Quando true, o botão do popup navega para a página de agendamento ao invés de abrir o link externo';