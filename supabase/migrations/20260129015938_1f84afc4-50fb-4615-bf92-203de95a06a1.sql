-- Add unique constraint for push notification tokens upsert
ALTER TABLE public.push_notification_tokens 
DROP CONSTRAINT IF EXISTS push_notification_tokens_clinic_token_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_notification_tokens_clinic_token 
ON public.push_notification_tokens (clinic_id, token);