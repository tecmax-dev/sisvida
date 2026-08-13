CREATE INDEX IF NOT EXISTS idx_patient_cards_active_expiry ON public.patient_cards (expires_at) WHERE is_active = true;

-- Ensure card_expiry_notifications table exists (from schema inspection, it does, but we ensure grants)
GRANT SELECT, INSERT ON public.card_expiry_notifications TO authenticated;
GRANT ALL ON public.card_expiry_notifications TO service_role;
