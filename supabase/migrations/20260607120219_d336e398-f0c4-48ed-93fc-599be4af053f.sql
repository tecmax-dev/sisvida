
CREATE TABLE public.appointment_sms_tokens (
  token text PRIMARY KEY,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL,
  phone text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  action_ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.appointment_sms_tokens TO service_role;

ALTER TABLE public.appointment_sms_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages sms tokens"
  ON public.appointment_sms_tokens
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_appointment_sms_tokens_appointment ON public.appointment_sms_tokens(appointment_id);
CREATE INDEX idx_appointment_sms_tokens_expires ON public.appointment_sms_tokens(expires_at);
