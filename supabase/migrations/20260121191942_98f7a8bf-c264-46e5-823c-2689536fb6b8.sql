-- =====================================================
-- SISTEMA DE BENEFÍCIOS E AUTORIZAÇÕES SINDICAIS
-- =====================================================

-- Tabela: Benefícios/Conveniados cadastrados pelo sindicato
CREATE TABLE public.union_benefits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  union_entity_id UUID REFERENCES public.union_entities(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  partner_name TEXT, -- Nome do convênio/empresa parceira
  partner_cnpj TEXT,
  partner_phone TEXT,
  partner_email TEXT,
  partner_address TEXT,
  category TEXT, -- Ex: saúde, educação, lazer, etc
  validity_days INTEGER DEFAULT 30, -- Validade padrão das autorizações em dias
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT union_benefits_clinic_id_name_unique UNIQUE (clinic_id, name)
);

-- Índices para performance
CREATE INDEX idx_union_benefits_clinic ON public.union_benefits(clinic_id);
CREATE INDEX idx_union_benefits_active ON public.union_benefits(clinic_id, is_active);

-- RLS
ALTER TABLE public.union_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view benefits from their clinic"
  ON public.union_benefits FOR SELECT
  USING (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users with permission can manage benefits"
  ON public.union_benefits FOR ALL
  USING (public.has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));

-- =====================================================
-- Tabela: Autorizações emitidas
-- =====================================================
CREATE TABLE public.union_authorizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  union_entity_id UUID REFERENCES public.union_entities(id) ON DELETE SET NULL,
  benefit_id UUID NOT NULL REFERENCES public.union_benefits(id) ON DELETE RESTRICT,
  
  -- Associado (titular)
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  
  -- Se for para dependente
  dependent_id UUID REFERENCES public.patient_dependents(id) ON DELETE SET NULL,
  is_for_dependent BOOLEAN NOT NULL DEFAULT false,
  
  -- Dados da autorização
  authorization_number TEXT NOT NULL,
  validation_hash TEXT NOT NULL UNIQUE, -- Hash para link público
  
  -- Datas
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'used')),
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by UUID REFERENCES auth.users(id),
  revocation_reason TEXT,
  
  -- Metadados
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Uso/visualizações
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMP WITH TIME ZONE,
  printed_at TIMESTAMP WITH TIME ZONE
);

-- Índices
CREATE INDEX idx_union_authorizations_clinic ON public.union_authorizations(clinic_id);
CREATE INDEX idx_union_authorizations_patient ON public.union_authorizations(patient_id);
CREATE INDEX idx_union_authorizations_dependent ON public.union_authorizations(dependent_id);
CREATE INDEX idx_union_authorizations_benefit ON public.union_authorizations(benefit_id);
CREATE INDEX idx_union_authorizations_hash ON public.union_authorizations(validation_hash);
CREATE INDEX idx_union_authorizations_status ON public.union_authorizations(clinic_id, status);
CREATE INDEX idx_union_authorizations_valid_until ON public.union_authorizations(valid_until);

-- RLS
ALTER TABLE public.union_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view authorizations from their clinic"
  ON public.union_authorizations FOR SELECT
  USING (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users with permission can manage authorizations"
  ON public.union_authorizations FOR ALL
  USING (public.has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));

-- =====================================================
-- Tabela: Assinatura da Presidência
-- =====================================================
CREATE TABLE public.union_president_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  union_entity_id UUID REFERENCES public.union_entities(id) ON DELETE SET NULL,
  
  -- Dados do presidente
  president_name TEXT NOT NULL,
  president_title TEXT DEFAULT 'Presidente',
  president_cpf TEXT,
  
  -- Assinatura digitalizada (base64 ou URL)
  signature_data TEXT, -- Base64 da imagem
  signature_url TEXT,  -- URL se armazenado em storage
  
  -- Controle
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT union_president_signatures_clinic_active_unique 
    UNIQUE (clinic_id, is_active) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Índice
CREATE INDEX idx_union_president_signatures_clinic ON public.union_president_signatures(clinic_id);

-- RLS
ALTER TABLE public.union_president_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view signatures from their clinic"
  ON public.union_president_signatures FOR SELECT
  USING (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Admins can manage signatures"
  ON public.union_president_signatures FOR ALL
  USING (public.is_clinic_admin(auth.uid(), clinic_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_clinic_admin(auth.uid(), clinic_id) OR public.is_super_admin(auth.uid()));

-- =====================================================
-- Funções auxiliares
-- =====================================================

-- Gerar número de autorização
CREATE OR REPLACE FUNCTION public.generate_authorization_number(p_clinic_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_count INTEGER;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.union_authorizations
  WHERE clinic_id = p_clinic_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
  
  RETURN 'AUT-' || v_year || '-' || LPAD(v_count::TEXT, 6, '0');
END;
$$;

-- Gerar hash de validação único
CREATE OR REPLACE FUNCTION public.generate_authorization_hash()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(gen_random_bytes(16), 'hex');
END;
$$;

-- Trigger para expirar autorizações automaticamente
CREATE OR REPLACE FUNCTION public.update_expired_authorizations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.union_authorizations
  SET status = 'expired', updated_at = now()
  WHERE status = 'active'
    AND valid_until < CURRENT_DATE;
END;
$$;

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.update_union_authorization_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_union_authorizations_timestamp
  BEFORE UPDATE ON public.union_authorizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_union_authorization_timestamp();

CREATE TRIGGER trigger_update_union_benefits_timestamp
  BEFORE UPDATE ON public.union_benefits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_union_authorization_timestamp();

CREATE TRIGGER trigger_update_union_president_signatures_timestamp
  BEFORE UPDATE ON public.union_president_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_union_authorization_timestamp();

-- Habilitar realtime para atualizações
ALTER PUBLICATION supabase_realtime ADD TABLE public.union_authorizations;