-- Tabela de integrações autenticadas (Tenant Binding)
CREATE TABLE IF NOT EXISTS public.whatsapp_integrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    api_key_hash text NOT NULL UNIQUE, -- Identificador da integração (x-prosinge-key)
    hmac_secret_vault_key text NOT NULL, -- Referência à chave no Vault
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_integrations ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.whatsapp_integrations TO service_role;
GRANT SELECT ON public.whatsapp_integrations TO authenticated;

-- Atualizar whatsapp_inbound_nonces para hardening
ALTER TABLE public.whatsapp_inbound_nonces 
ADD COLUMN IF NOT EXISTS integration_id uuid REFERENCES public.whatsapp_integrations(id),
ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '10 minutes');

-- Atualizar whatsapp_inbound_decisions para hardening
ALTER TABLE public.whatsapp_inbound_decisions
ADD COLUMN IF NOT EXISTS integration_id uuid REFERENCES public.whatsapp_integrations(id),
ADD COLUMN IF NOT EXISTS canonical_string text;

-- Função para validar se o clinic_id da requisição bate com o da integração
CREATE OR REPLACE FUNCTION public.check_whatsapp_tenant_binding(_integration_id uuid, _clinic_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.whatsapp_integrations
        WHERE id = _integration_id AND clinic_id = _clinic_id AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir privilégios
GRANT EXECUTE ON FUNCTION public.check_whatsapp_tenant_binding TO service_role;

