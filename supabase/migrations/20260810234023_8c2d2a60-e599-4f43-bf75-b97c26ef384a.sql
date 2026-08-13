CREATE OR REPLACE FUNCTION public.handle_whatsapp_request_payslip()
RETURNS TRIGGER AS $$
DECLARE
    v_clinic_id uuid;
    v_member_name text;
    v_portal_url text;
    v_message text;
BEGIN
    IF NEW.decision = 'REQUEST_PAYSLIP' THEN
        SELECT clinic_id, name INTO v_clinic_id, v_member_name 
        FROM public.patients 
        WHERE id = NEW.patient_id;
        
        IF v_clinic_id IS NULL THEN
            v_clinic_id := NEW.clinic_id;
        END IF;

        v_portal_url := 'https://sisvida.lovable.app/portal/associado';
        v_message := 'Olá ' || COALESCE(v_member_name, 'Associado') || '! Para atualizar sua carteirinha, por favor acesse nosso Portal do Associado e envie seu último contracheque: ' || v_portal_url;

        INSERT INTO public.whatsapp_outbox (
            clinic_id,
            patient_id,
            phone,
            content,
            purpose,
            status,
            priority
        ) VALUES (
            v_clinic_id,
            NEW.patient_id,
            NEW.phone,
            v_message,
            'REQUEST_PAYSLIP_RESPONSE',
            'PENDING',
            10
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_handle_whatsapp_request_payslip ON public.whatsapp_inbound_decisions;
CREATE TRIGGER tr_handle_whatsapp_request_payslip
AFTER INSERT ON public.whatsapp_inbound_decisions
FOR EACH ROW
EXECUTE FUNCTION public.handle_whatsapp_request_payslip();