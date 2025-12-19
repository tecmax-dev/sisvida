-- =====================================================
-- MÓDULO SAAS: Planos de Assinatura e Controle de Limites
-- =====================================================

-- 1. Tabela de Planos de Assinatura
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  max_professionals INTEGER NOT NULL DEFAULT 1,
  monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  external_plan_id TEXT,
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true,
  is_default_trial BOOLEAN DEFAULT false,
  features JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice único para garantir apenas um plano trial padrão
CREATE UNIQUE INDEX idx_single_default_trial 
ON public.subscription_plans (is_default_trial) 
WHERE is_default_trial = true;

-- 2. Tabela de Assinaturas das Clínicas
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'suspended', 'canceled')),
  external_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinic_id)
);

-- 3. Habilitar RLS nas novas tabelas
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para subscription_plans
CREATE POLICY "Public can view active public plans"
ON public.subscription_plans FOR SELECT
USING (is_active = true AND is_public = true);

CREATE POLICY "Super admins can manage plans"
ON public.subscription_plans FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Authenticated can view active plans"
ON public.subscription_plans FOR SELECT
TO authenticated
USING (is_active = true);

-- 5. Políticas RLS para subscriptions
CREATE POLICY "Clinic members can view subscription"
ON public.subscriptions FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can update subscription"
ON public.subscriptions FOR UPDATE
USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Super admins can manage subscriptions"
ON public.subscriptions FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "System can insert subscriptions"
ON public.subscriptions FOR INSERT
WITH CHECK (true);

-- 6. Triggers de updated_at
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Função para validar limite de profissionais
CREATE OR REPLACE FUNCTION public.check_professional_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  sub_status TEXT;
  plan_name TEXT;
BEGIN
  -- Contar profissionais ativos da clínica
  SELECT COUNT(*) INTO current_count
  FROM public.professionals
  WHERE clinic_id = NEW.clinic_id AND is_active = true;
  
  -- Obter limite do plano e status da assinatura
  SELECT sp.max_professionals, sp.name, s.status 
  INTO max_allowed, plan_name, sub_status
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON s.plan_id = sp.id
  WHERE s.clinic_id = NEW.clinic_id;
  
  -- Se não encontrou assinatura, permitir (clínicas legadas)
  IF sub_status IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verificar se assinatura está ativa
  IF sub_status NOT IN ('trial', 'active') THEN
    RAISE EXCEPTION 'ASSINATURA_INVALIDA: Sua assinatura está %. Por favor, regularize para adicionar profissionais.', sub_status;
  END IF;
  
  -- Verificar limite de profissionais
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'LIMITE_PROFISSIONAIS: Você atingiu o limite de % profissional(is) do plano %. Faça upgrade para adicionar mais.', max_allowed, plan_name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Trigger para validar criação de profissionais
CREATE TRIGGER trigger_check_professional_limit
BEFORE INSERT ON public.professionals
FOR EACH ROW
EXECUTE FUNCTION public.check_professional_limit();

-- 9. Inserir plano Trial padrão
INSERT INTO public.subscription_plans (
  name, 
  description, 
  max_professionals, 
  monthly_price, 
  is_default_trial, 
  is_public,
  features
)
VALUES (
  'Trial', 
  'Plano gratuito de avaliação com 1 profissional', 
  1, 
  0, 
  true, 
  false,
  '["Agendamento online", "Prontuário eletrônico", "1 profissional", "14 dias de teste"]'::jsonb
);