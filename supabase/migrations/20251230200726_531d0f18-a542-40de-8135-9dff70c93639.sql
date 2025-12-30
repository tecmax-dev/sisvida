-- Add Evolution instance name to global config
ALTER TABLE public.global_config
ADD COLUMN IF NOT EXISTS evolution_instance text;

-- Backfill from existing secret/default if desired (leave null by default)
-- No data migration needed.
