DELETE FROM public.whatsapp_one_shot_authorizations WHERE cpf = '55905552568';
INSERT INTO public.whatsapp_one_shot_authorizations (cpf, phone, status, idempotency_key, template_name, template_language, expires_at)
VALUES ('55905552568', '73988633535', 'authorized', 'one-shot-fix-template-v4', 'carteirinha_atualizacao_necessaria', 'pt_BR', now() + interval '24 hours');