-- 1. Create secure token table for homologation views
CREATE TABLE IF NOT EXISTS public.homologacao_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES public.homologacao_appointments(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('employee', 'employer')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT ON public.homologacao_access_tokens TO authenticated;
GRANT SELECT ON public.homologacao_access_tokens TO anon;
GRANT ALL ON public.homologacao_access_tokens TO service_role;

-- RLS
ALTER TABLE public.homologacao_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read by token" 
ON public.homologacao_access_tokens 
FOR SELECT 
TO anon 
USING (expires_at > now());

-- 2. Add consent columns to homologacao_appointments (cached for snapshot)
-- Note: Real consent is stored in whatsapp_consents, but we mirror it for idempotent gates
ALTER TABLE public.homologacao_appointments 
ADD COLUMN IF NOT EXISTS employee_whatsapp_consent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS company_whatsapp_consent BOOLEAN DEFAULT false;

-- 3. Idempotency table for Meta Official
CREATE TABLE IF NOT EXISTS public.whatsapp_delivery_idempotency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE, -- e.g. "HOMOLOGACAO_CONFIRMED:<id>:<recipient>"
    status TEXT DEFAULT 'sent',
    delivered_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT ON public.whatsapp_delivery_idempotency TO authenticated;
GRANT ALL ON public.whatsapp_delivery_idempotency TO service_role;
