-- Add missing columns to whatsapp_booking_sessions table
-- These columns are used by the booking flow but were missing from the schema

-- Column for storing the list of appointments (for cancel/reschedule flows)
ALTER TABLE public.whatsapp_booking_sessions
ADD COLUMN IF NOT EXISTS appointments_list JSONB DEFAULT NULL;

-- Column for storing the list action type (cancel or reschedule)
ALTER TABLE public.whatsapp_booking_sessions
ADD COLUMN IF NOT EXISTS list_action TEXT DEFAULT NULL;

-- Column for storing available procedures
ALTER TABLE public.whatsapp_booking_sessions
ADD COLUMN IF NOT EXISTS available_procedures JSONB DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.whatsapp_booking_sessions.appointments_list IS 'List of patient appointments for cancel/reschedule operations';
COMMENT ON COLUMN public.whatsapp_booking_sessions.list_action IS 'The action being performed: cancel or reschedule';
COMMENT ON COLUMN public.whatsapp_booking_sessions.available_procedures IS 'List of available procedures for the selected professional';