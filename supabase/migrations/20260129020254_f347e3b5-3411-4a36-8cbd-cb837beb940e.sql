-- Allow patient_id to be NULL for admin/staff push notifications
ALTER TABLE public.push_notification_tokens 
ALTER COLUMN patient_id DROP NOT NULL;

-- Add user_id column for auth user reference (admins/staff)
ALTER TABLE public.push_notification_tokens 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update unique constraint to handle both patient and user tokens
DROP INDEX IF EXISTS idx_push_notification_tokens_clinic_token;

CREATE UNIQUE INDEX idx_push_notification_tokens_clinic_token 
ON public.push_notification_tokens (clinic_id, token);

-- Add check constraint to ensure at least one identifier is present
ALTER TABLE public.push_notification_tokens 
DROP CONSTRAINT IF EXISTS push_notification_tokens_has_identifier;

ALTER TABLE public.push_notification_tokens 
ADD CONSTRAINT push_notification_tokens_has_identifier 
CHECK (patient_id IS NOT NULL OR user_id IS NOT NULL);