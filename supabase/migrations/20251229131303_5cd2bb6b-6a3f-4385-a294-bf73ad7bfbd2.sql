-- Add new columns for cancel/reschedule flows
ALTER TABLE public.whatsapp_booking_sessions 
ADD COLUMN IF NOT EXISTS pending_appointments jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS selected_appointment_id uuid DEFAULT NULL,
ADD COLUMN IF NOT EXISTS action_type text DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.whatsapp_booking_sessions.action_type IS 'Type of action: new, cancel, reschedule';
COMMENT ON COLUMN public.whatsapp_booking_sessions.pending_appointments IS 'List of patient appointments for cancel/reschedule selection';
COMMENT ON COLUMN public.whatsapp_booking_sessions.selected_appointment_id IS 'Selected appointment ID for cancel/reschedule';