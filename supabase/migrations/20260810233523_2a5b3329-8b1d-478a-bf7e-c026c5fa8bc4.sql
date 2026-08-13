INSERT INTO public.whatsapp_integrations (clinic_id, name, api_key_hash, hmac_secret_vault_key, is_active)
VALUES ('89e7585e-7bce-4e58-91fa-c37080d1170d', 'Chatwoot Audit Integration', 'ps_audit_key_2026', 'PROSINGE_N8N_HMAC_SECRET', true)
ON CONFLICT (api_key_hash) DO UPDATE SET is_active = true;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='n8n_configs' AND column_name='enabled') THEN
        INSERT INTO public.n8n_configs (clinic_id, n8n_url, n8n_api_token_secret_name, enabled)
        VALUES ('89e7585e-7bce-4e58-91fa-c37080d1170d', 'https://conecta.zapresponde.app', 'N8N_API_KEY_89e7585e_7bce_4e58_91fa_c37080d1170d', true)
        ON CONFLICT (clinic_id) DO UPDATE SET n8n_url = EXCLUDED.n8n_url;
    ELSE
        INSERT INTO public.n8n_configs (clinic_id, n8n_url, n8n_api_token_secret_name)
        VALUES ('89e7585e-7bce-4e58-91fa-c37080d1170d', 'https://conecta.zapresponde.app', 'N8N_API_KEY_89e7585e_7bce_4e58_91fa_c37080d1170d')
        ON CONFLICT (clinic_id) DO UPDATE SET n8n_url = EXCLUDED.n8n_url;
    END IF;
END $$;