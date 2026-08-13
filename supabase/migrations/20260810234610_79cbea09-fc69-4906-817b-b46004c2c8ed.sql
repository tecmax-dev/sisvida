-- 1. Correct the Outbox Table Structure and Trigger
-- Based on error 42703, 'content' column is missing. I'll use the correct columns found in previous schema audit.
-- Schema audit found: id, clinic_id, event_id, patient_id, phone, template_name, category, purpose, payload, deduplication_key, status, dry_run, attempts, scheduled_at, processed_at, provider, provider_message_id, error_code, error_message, gate_reason, created_at, updated_at, compliance_status, compliance_reason, compliance_checked_at.

-- AND I missed 'conversation_id' in the last audit, so I should add it if I want to use it, or store it in payload.

ALTER TABLE public.whatsapp_outbox ADD COLUMN IF NOT EXISTS conversation_id integer;
ALTER TABLE public.whatsapp_outbox ADD COLUMN IF NOT EXISTS content text; -- Adding content column which was missing

CREATE OR REPLACE FUNCTION public.handle_whatsapp_request_payslip()
RETURNS TRIGGER AS $$
DECLARE
    v_clinic_id uuid;
    v_member_name text;
    v_portal_url text;
    v_message text;
BEGIN
    IF NEW.decision = 'REQUEST_PAYSLIP' THEN
        -- 1. Identify Member and Clinic
        SELECT clinic_id, name INTO v_clinic_id, v_member_name 
        FROM public.patients 
        WHERE id = NEW.patient_id;
        
        IF v_clinic_id IS NULL THEN
            v_clinic_id := NEW.clinic_id;
        END IF;

        -- 2. Construct response
        v_portal_url := 'https://sisvida.lovable.app/portal/associado';
        v_message := 'Olá ' || COALESCE(v_member_name, 'Associado') || '! Para atualizar sua carteirinha, por favor acesse nosso Portal do Associado e envie seu último contracheque: ' || v_portal_url;

        -- 3. Insert into Outbox (internal storage)
        INSERT INTO public.whatsapp_outbox (
            clinic_id,
            patient_id,
            phone,
            content,
            purpose,
            status,
            conversation_id
        ) VALUES (
            v_clinic_id,
            NEW.patient_id,
            NEW.phone,
            v_message,
            'REQUEST_PAYSLIP_RESPONSE',
            'PENDING',
            (NEW.payload->>'conversation_id')::integer
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-enable the trigger
DROP TRIGGER IF EXISTS tr_handle_whatsapp_request_payslip ON public.whatsapp_inbound_decisions;
CREATE TRIGGER tr_handle_whatsapp_request_payslip
AFTER INSERT ON public.whatsapp_inbound_decisions
FOR EACH ROW
EXECUTE FUNCTION public.handle_whatsapp_request_payslip();

GRANT ALL ON public.whatsapp_outbox TO service_role;
GRANT ALL ON public.whatsapp_inbound_decisions TO service_role;
GRANT ALL ON public.patients TO service_role;
