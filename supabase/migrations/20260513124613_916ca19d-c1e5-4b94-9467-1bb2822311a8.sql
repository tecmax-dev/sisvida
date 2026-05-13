ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS reminder_interval INTEGER DEFAULT 60;

COMMENT ON COLUMN public.clinics.reminder_interval IS 'Interval in seconds between sending each WhatsApp reminder';