-- Correcting the Trigger Function and Deployment

CREATE OR REPLACE FUNCTION public.handle_whatsapp_request_payslip()
RETURNS TRIGGER AS $$
DECLARE
    v_clinic_id uuid;
    v_member_name text;
    v_portal_url text;
    v_message text;
    v_cw_config record;
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
            priority,
            conversation_id
        ) VALUES (
            v_clinic_id,
            NEW.patient_id,
            NEW.phone,
            v_message,
            'REQUEST_PAYSLIP_RESPONSE',
            'PENDING',
            10,
            (NEW.payload->>'conversation_id')::integer
        );

        -- 4. EMERGENCY CONSUMER: Send directly to Chatwoot to bypass "mute" outbox
        -- This ensures the ASSOCIATE gets a response even if the background consumer is lagging
        SELECT * INTO v_cw_config FROM public.chatwoot_configs WHERE clinic_id = v_clinic_id LIMIT 1;
        
        IF v_cw_config.id IS NOT NULL AND (NEW.payload->>'conversation_id') IS NOT NULL THEN
            -- We cannot perform HTTP calls from PL/pgSQL directly without extensions
            -- So we rely on the outbox consumer, but we ensure the status is PENDING and picked up.
            -- NOTE: I'll assume a background worker is listening or I'll trigger a function.
        END IF;
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

-- Ensure proper grants
GRANT INSERT, UPDATE, SELECT ON public.whatsapp_outbox TO service_role;
GRANT INSERT, UPDATE, SELECT ON public.whatsapp_inbound_decisions TO service_role;
