-- 1. Campos de Compliance na Outbox
ALTER TABLE public.whatsapp_outbox 
ADD COLUMN IF NOT EXISTS compliance_status text,
ADD COLUMN IF NOT EXISTS compliance_reason text,
ADD COLUMN IF NOT EXISTS compliance_checked_at timestamp with time zone;

-- 2. Campos de Segurança Inbound
ALTER TABLE public.whatsapp_inbound_decisions 
ADD COLUMN IF NOT EXISTS nonce text,
ADD COLUMN IF NOT EXISTS signature text,
ADD COLUMN IF NOT EXISTS reason_code text;

-- 3. Tabela de Nonces (Anti-Replay)
CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_nonces (
    nonce text PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now()
);

-- 4. Grants
GRANT ALL ON public.whatsapp_inbound_nonces TO service_role;
GRANT ALL ON public.whatsapp_inbound_decisions TO service_role;
GRANT ALL ON public.whatsapp_outbox TO service_role;

-- 5. Constraint de Unicidade para request_id no inbound
ALTER TABLE public.whatsapp_inbound_decisions 
DROP CONSTRAINT IF EXISTS whatsapp_inbound_decisions_request_id_key;

ALTER TABLE public.whatsapp_inbound_decisions 
ADD CONSTRAINT whatsapp_inbound_decisions_request_id_key UNIQUE (request_id);
