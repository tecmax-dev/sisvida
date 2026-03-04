
-- Table to track sent overdue installment notifications (avoid duplicates)
CREATE TABLE IF NOT EXISTS public.negotiation_installment_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id uuid NOT NULL REFERENCES public.negotiation_installments(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  phone text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index to quickly check if notification was already sent for an installment today
CREATE INDEX idx_notif_installment_sent ON public.negotiation_installment_notifications(installment_id, sent_at);
CREATE INDEX idx_notif_clinic ON public.negotiation_installment_notifications(clinic_id);

-- RLS
ALTER TABLE public.negotiation_installment_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic users can view their notifications"
  ON public.negotiation_installment_notifications
  FOR SELECT
  TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  );
