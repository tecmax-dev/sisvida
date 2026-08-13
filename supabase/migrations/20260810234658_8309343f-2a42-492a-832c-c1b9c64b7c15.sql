-- FINAL TECHNICAL TEST
DO $$
DECLARE
    v_clinic_id uuid := '89e7585e-7bce-4e58-91fa-c37080d1170d';
    v_patient_id uuid;
    v_integration_id uuid;
    v_request_id uuid := gen_random_uuid();
BEGIN
    SELECT id INTO v_patient_id FROM public.patients WHERE phone LIKE '%55905552568%' LIMIT 1;
    SELECT id INTO v_integration_id FROM public.whatsapp_integrations WHERE clinic_id = v_clinic_id AND is_active = true LIMIT 1;

    INSERT INTO public.whatsapp_inbound_decisions (
        clinic_id,
        integration_id,
        patient_id,
        phone,
        inbound_event,
        decision,
        payload,
        request_id
    ) VALUES (
        v_clinic_id,
        v_integration_id,
        v_patient_id,
        '55905552568',
        'WEBHOOK_MESSAGE_CREATED',
        'REQUEST_PAYSLIP',
        '{"conversation_id": 156, "button_reply": {"payload": "REQUEST_PAYSLIP"}}'::jsonb,
        v_request_id
    );
END $$;
