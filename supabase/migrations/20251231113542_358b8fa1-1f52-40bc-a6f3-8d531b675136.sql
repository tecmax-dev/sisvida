ALTER TABLE public.whatsapp_booking_sessions
ADD COLUMN IF NOT EXISTS is_dependent_direct_booking boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_whatsapp_booking_sessions_dependent_direct
ON public.whatsapp_booking_sessions (clinic_id, phone, is_dependent_direct_booking);
