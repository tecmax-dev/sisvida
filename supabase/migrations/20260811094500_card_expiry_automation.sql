-- Create an index to speed up the daily query
CREATE INDEX IF NOT EXISTS idx_patient_cards_active_expiry ON public.patient_cards (expires_at) WHERE is_active = true;

-- Function to check if a card notice should be sent (Dry Run version logic)
-- In a real scenario, this would be a trigger or a cron job.
-- For now, we follow the "PARE" instruction and only implement the structure.

GRANT SELECT, INSERT ON public.card_expiry_notifications TO authenticated;
GRANT ALL ON public.card_expiry_notifications TO service_role;
