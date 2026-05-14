ALTER TABLE public.whatsapp_audit_logs
DROP CONSTRAINT IF EXISTS whatsapp_audit_logs_direction_check;

ALTER TABLE public.whatsapp_audit_logs
ADD CONSTRAINT whatsapp_audit_logs_direction_check
CHECK (direction IN ('incoming', 'outgoing', 'status'));

CREATE INDEX IF NOT EXISTS idx_whatsapp_audit_meta_message_id
ON public.whatsapp_audit_logs ((metadata->>'message_id'))
WHERE message_type = 'meta_status';