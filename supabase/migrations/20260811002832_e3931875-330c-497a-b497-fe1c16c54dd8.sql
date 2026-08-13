
-- 1. Create the missing compliance table to fix Orchestrator v2 runtime error
CREATE TABLE IF NOT EXISTS public.whatsapp_compliance_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    click_message_id text,
    conversation_id text,
    patient_id uuid REFERENCES public.patients(id),
    intent text,
    decision text,
    window_status text,
    chatwoot_message_id text,
    metadata jsonb
);

GRANT SELECT, INSERT ON public.whatsapp_compliance_logs TO authenticated;
GRANT ALL ON public.whatsapp_compliance_logs TO service_role;

-- 2. Correct patient status column in query (it's 'state' or we omit it for resolution)
SELECT id, name, cpf, phone FROM public.patients 
WHERE cpf = '55905552568' OR phone ILIKE '%55905552568%';

-- 3. Check for the click in raw logs since decisions/events are empty for today
SELECT id, created_at, phone, message_text, raw_payload, processed
FROM public.whatsapp_incoming_logs
WHERE created_at > '2026-08-11 00:00:00+00'
ORDER BY created_at DESC;

-- 4. Check chatwoot_configs columns
SELECT * FROM public.chatwoot_configs;
