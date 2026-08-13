-- Garantir que a extensão pgcrypto está disponível para gen_random_uuid se necessário
-- Embora nativa no PG13+, boa prática garantir.

-- 1. Inserir a integração principal para a clínica de teste se não existir
INSERT INTO public.whatsapp_integrations (clinic_id, name, api_key_hash, hmac_secret_vault_key, is_active)
VALUES (
    '89e7585e-7bce-4e58-91fa-c37080d1170d', 
    'Chatwoot Main Integration', 
    'ps_audit_key_2026', 
    'PROSINGE_N8N_HMAC_SECRET', 
    true
)
ON CONFLICT (api_key_hash) DO UPDATE SET is_active = true;

-- 2. Configurar RLS para permitir que o service_role e anon (para o webhook do Chatwoot) interajam com as tabelas necessárias
-- O webhook do Chatwoot chama n8n-inbound (Edge Function), que usa service_role.
-- Mas a tabela whatsapp_inbound_decisions precisa de GRANTs para service_role.

GRANT ALL ON public.whatsapp_integrations TO service_role;
GRANT ALL ON public.whatsapp_inbound_decisions TO service_role;
GRANT ALL ON public.whatsapp_inbound_nonces TO service_role;

-- 3. Habilitar RLS em n8n_configs se não estiver
ALTER TABLE public.n8n_configs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.n8n_configs TO service_role;

-- 4. Inserir config n8n padrão
INSERT INTO public.n8n_configs (clinic_id, n8n_url, n8n_api_token_secret_name, enabled)
VALUES ('89e7585e-7bce-4e58-91fa-c37080d1170d', 'https://conecta.zapresponde.app', 'N8N_API_KEY_89e7585e_7bce_4e58_91fa_c37080d1170d', true)
ON CONFLICT (clinic_id) DO UPDATE SET enabled = true;

