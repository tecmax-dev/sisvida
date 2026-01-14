-- Add WhatsApp marketing settings column to clinics table
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS whatsapp_message_delay_seconds INTEGER DEFAULT 10;

-- Add comment for documentation
COMMENT ON COLUMN public.clinics.whatsapp_message_delay_seconds IS 'Intervalo em segundos entre mensagens de marketing WhatsApp para evitar banimento';