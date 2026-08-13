-- Corrected Authorize a new one-shot for CPF 55905552568
INSERT INTO public.whatsapp_one_shot_authorizations (
    cpf, 
    phone,
    clinic_id, 
    status,
    template_name,
    idempotency_key
) VALUES (
    '55905552568', 
    '55905552568',
    '89e7585e-7bce-4e58-91fa-c37080d1170d', 
    'authorized',
    'carteirinha_atualizacao_necessaria',
    'audit_final_' || gen_random_uuid()::text
);
