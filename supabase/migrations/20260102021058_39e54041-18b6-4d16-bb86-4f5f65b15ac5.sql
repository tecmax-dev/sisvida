-- Add pending_registration_relationship column to whatsapp_booking_sessions
ALTER TABLE public.whatsapp_booking_sessions
ADD COLUMN IF NOT EXISTS pending_registration_relationship TEXT;