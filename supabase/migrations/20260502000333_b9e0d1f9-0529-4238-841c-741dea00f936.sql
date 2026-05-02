-- Add Z-API token to evolution_configs
ALTER TABLE public.evolution_configs ADD COLUMN IF NOT EXISTS zapi_token TEXT;
ALTER TABLE public.evolution_configs ADD COLUMN IF NOT EXISTS instance_id TEXT;

-- Update clinic whatsapp_provider check constraint if it exists, or just allow the value
-- If there's no constraint, we can just insert the value.
-- Let's check if there are any constraints on whatsapp_provider
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clinics' AND column_name = 'whatsapp_provider') THEN
        -- No action needed if no constraint, but we want to make sure 'zapi' is a valid value in logic
    END IF;
END $$;
