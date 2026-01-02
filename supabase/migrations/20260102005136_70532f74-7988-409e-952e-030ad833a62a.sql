-- Add missing registration flow columns to whatsapp_booking_sessions
ALTER TABLE public.whatsapp_booking_sessions
ADD COLUMN IF NOT EXISTS pending_registration_name TEXT,
ADD COLUMN IF NOT EXISTS pending_registration_birthdate TEXT,
ADD COLUMN IF NOT EXISTS pending_registration_cnpj TEXT;