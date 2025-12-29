-- Add columns for dependent booking support in WhatsApp sessions
ALTER TABLE public.whatsapp_booking_sessions
ADD COLUMN IF NOT EXISTS available_dependents JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS selected_dependent_id UUID,
ADD COLUMN IF NOT EXISTS selected_dependent_name TEXT,
ADD COLUMN IF NOT EXISTS booking_for TEXT DEFAULT 'patient';