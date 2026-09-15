CREATE TABLE public.whatsapp_webhook_dedup (
  dedup_key text PRIMARY KEY,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.whatsapp_webhook_dedup TO service_role;

ALTER TABLE public.whatsapp_webhook_dedup ENABLE ROW LEVEL SECURITY;

CREATE INDEX whatsapp_webhook_dedup_created_at_idx
  ON public.whatsapp_webhook_dedup (created_at);