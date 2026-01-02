-- Fix WhatsApp booking registration flow: persist CPF for pending registration
-- The webhook expects this column when offering self-registration.

ALTER TABLE public.whatsapp_booking_sessions
ADD COLUMN IF NOT EXISTS pending_registration_cpf text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_booking_sessions_pending_registration_cpf
ON public.whatsapp_booking_sessions (pending_registration_cpf);
