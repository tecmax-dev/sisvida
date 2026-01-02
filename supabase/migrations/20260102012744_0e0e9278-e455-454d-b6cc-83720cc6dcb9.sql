-- Add columns to support registration type (titular/dependent) and insurance plan selection
ALTER TABLE whatsapp_booking_sessions 
ADD COLUMN IF NOT EXISTS pending_registration_type text, -- 'titular' or 'dependent'
ADD COLUMN IF NOT EXISTS pending_registration_titular_cpf text, -- CPF of titular when registering dependent
ADD COLUMN IF NOT EXISTS pending_registration_insurance_plan_id uuid; -- Selected insurance plan

-- Add comment for documentation
COMMENT ON COLUMN whatsapp_booking_sessions.pending_registration_type IS 'Type of registration: titular or dependent';
COMMENT ON COLUMN whatsapp_booking_sessions.pending_registration_titular_cpf IS 'CPF of titular patient when registering a dependent';
COMMENT ON COLUMN whatsapp_booking_sessions.pending_registration_insurance_plan_id IS 'Selected insurance plan for new registration';