-- =====================================================
-- SISTEMA DE ADD-ONS (PRODUTOS ADICIONAIS)
-- =====================================================

-- Tabela de definição dos add-ons disponíveis
CREATE TABLE public.subscription_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE, -- 'whatsapp_advanced', 'api_access'
  description TEXT,
  monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb, -- Lista de features que o add-on libera
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de add-ons contratados por clínica
CREATE TABLE public.clinic_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES public.subscription_addons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  activated_at TIMESTAMPTZ DEFAULT now(),
  activated_by UUID REFERENCES auth.users(id),
  suspended_at TIMESTAMPTZ,
  suspended_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(clinic_id, addon_id)
);

-- Tabela de solicitações de add-ons
CREATE TABLE public.addon_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES public.subscription_addons(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  request_reason TEXT,
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addon_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_addons
CREATE POLICY "Anyone can view active addons"
  ON public.subscription_addons FOR SELECT
  USING (is_active = true OR is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage addons"
  ON public.subscription_addons FOR ALL
  USING (is_super_admin(auth.uid()));

-- RLS Policies for clinic_addons
CREATE POLICY "Super admins can manage clinic addons"
  ON public.clinic_addons FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Clinic members can view their addons"
  ON public.clinic_addons FOR SELECT
  USING (has_clinic_access(auth.uid(), clinic_id));

-- RLS Policies for addon_requests
CREATE POLICY "Super admins can manage all requests"
  ON public.addon_requests FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Clinic admins can create requests"
  ON public.addon_requests FOR INSERT
  WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can view their requests"
  ON public.addon_requests FOR SELECT
  USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can update pending requests"
  ON public.addon_requests FOR UPDATE
  USING (is_clinic_admin(auth.uid(), clinic_id) AND status = 'pending');

-- Triggers for updated_at
CREATE TRIGGER update_subscription_addons_updated_at
  BEFORE UPDATE ON public.subscription_addons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinic_addons_updated_at
  BEFORE UPDATE ON public.clinic_addons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_addon_requests_updated_at
  BEFORE UPDATE ON public.addon_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check if clinic has an addon
CREATE OR REPLACE FUNCTION public.clinic_has_addon(_clinic_id UUID, _addon_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM clinic_addons ca
    JOIN subscription_addons sa ON sa.id = ca.addon_id
    WHERE ca.clinic_id = _clinic_id
    AND sa.key = _addon_key
    AND ca.status = 'active'
    AND sa.is_active = true
  )
$$;

-- Insert default add-ons
INSERT INTO public.subscription_addons (name, key, description, monthly_price, features, order_index) VALUES
(
  'WhatsApp Avançado', 
  'whatsapp_advanced', 
  'Campanhas de marketing, automações, IA assistente, lembretes automáticos e agendamento por WhatsApp',
  99.90,
  '["whatsapp_campaigns", "whatsapp_automations", "whatsapp_ai", "whatsapp_reminders", "whatsapp_booking"]'::jsonb,
  1
),
(
  'API Externa', 
  'api_access', 
  'Acesso completo à API para integrações com sistemas externos, webhooks e automações personalizadas',
  149.90,
  '["api_full_access", "webhooks", "custom_integrations"]'::jsonb,
  2
);

-- Add indexes for better performance
CREATE INDEX idx_clinic_addons_clinic_id ON public.clinic_addons(clinic_id);
CREATE INDEX idx_clinic_addons_status ON public.clinic_addons(status);
CREATE INDEX idx_addon_requests_clinic_id ON public.addon_requests(clinic_id);
CREATE INDEX idx_addon_requests_status ON public.addon_requests(status);