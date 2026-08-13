-- Final Fix for Trigger Function addressing all NOT NULL constraints

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

        -- 3. Insert into Outbox
        INSERT INTO public.whatsapp_outbox (
            clinic_id,
            patient_id,
            phone,
            content,
            purpose,
            status,
            conversation_id,
            template_name,
            category,
            deduplication_key
        ) VALUES (
            v_clinic_id,
            NEW.patient_id,
            NEW.phone,
            v_message,
            'REQUEST_PAYSLIP_RESPONSE',
            'PENDING',
            (NEW.payload->>'conversation_id')::integer,
            'internal_response',
            'TRANSACTIONAL',
            'REQ_PAYSLIP_' || NEW.request_id::text -- Ensuring uniqueness via request_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
