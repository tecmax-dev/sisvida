-- Add booking_enabled column to evolution_configs
ALTER TABLE evolution_configs 
ADD COLUMN IF NOT EXISTS booking_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN evolution_configs.booking_enabled IS 
'Quando false, desabilita o agendamento via WhatsApp';