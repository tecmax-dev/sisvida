ALTER TABLE public.chatwoot_configs
  ADD COLUMN IF NOT EXISTS webhook_secret text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '');