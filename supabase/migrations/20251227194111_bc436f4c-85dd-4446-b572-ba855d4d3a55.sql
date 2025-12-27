
-- =====================================================
-- FASE 2: Repasse Médico
-- =====================================================

-- 1. Regras de Repasse Médico
CREATE TABLE public.medical_repass_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE,
  procedure_id UUID REFERENCES public.procedures(id) ON DELETE SET NULL,
  insurance_plan_id UUID REFERENCES public.insurance_plans(id) ON DELETE SET NULL,
  calculation_type TEXT NOT NULL CHECK (calculation_type IN ('percentage', 'fixed')),
  value NUMERIC(12,2) NOT NULL CHECK (value >= 0),
  priority INTEGER NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX idx_medical_repass_rules_clinic ON public.medical_repass_rules(clinic_id);
CREATE INDEX idx_medical_repass_rules_professional ON public.medical_repass_rules(professional_id);
CREATE INDEX idx_medical_repass_rules_procedure ON public.medical_repass_rules(procedure_id);
CREATE INDEX idx_medical_repass_rules_insurance ON public.medical_repass_rules(insurance_plan_id);
CREATE INDEX idx_medical_repass_rules_active ON public.medical_repass_rules(clinic_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_medical_repass_rules_effective ON public.medical_repass_rules(clinic_id, effective_from, effective_until);

-- RLS
ALTER TABLE public.medical_repass_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medical_repass_rules_select" ON public.medical_repass_rules
  FOR SELECT USING (
    has_clinic_access(auth.uid(), clinic_id)
    AND (deleted_at IS NULL OR is_super_admin(auth.uid()))
  );

CREATE POLICY "medical_repass_rules_admin" ON public.medical_repass_rules
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Trigger para updated_at
CREATE TRIGGER update_medical_repass_rules_updated_at
  BEFORE UPDATE ON public.medical_repass_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Períodos de Repasse (fechamento mensal)
CREATE TABLE public.medical_repass_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  reference_month INTEGER NOT NULL CHECK (reference_month >= 1 AND reference_month <= 12),
  reference_year INTEGER NOT NULL CHECK (reference_year >= 2020),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'calculated', 'approved', 'paid')),
  total_gross NUMERIC(12,2) DEFAULT 0,
  total_repass NUMERIC(12,2) DEFAULT 0,
  calculated_at TIMESTAMP WITH TIME ZONE,
  calculated_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (clinic_id, reference_month, reference_year)
);

-- Índices
CREATE INDEX idx_medical_repass_periods_clinic ON public.medical_repass_periods(clinic_id);
CREATE INDEX idx_medical_repass_periods_status ON public.medical_repass_periods(clinic_id, status);
CREATE INDEX idx_medical_repass_periods_date ON public.medical_repass_periods(clinic_id, reference_year, reference_month);

-- RLS
ALTER TABLE public.medical_repass_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medical_repass_periods_select" ON public.medical_repass_periods
  FOR SELECT USING (
    has_clinic_access(auth.uid(), clinic_id)
    AND (deleted_at IS NULL OR is_super_admin(auth.uid()))
  );

CREATE POLICY "medical_repass_periods_admin" ON public.medical_repass_periods
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Trigger para updated_at
CREATE TRIGGER update_medical_repass_periods_updated_at
  BEFORE UPDATE ON public.medical_repass_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Itens de Repasse (calculados)
CREATE TABLE public.medical_repass_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES public.medical_repass_periods(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  procedure_id UUID REFERENCES public.procedures(id) ON DELETE SET NULL,
  insurance_plan_id UUID REFERENCES public.insurance_plans(id) ON DELETE SET NULL,
  gross_amount NUMERIC(12,2) NOT NULL,
  rule_id UUID REFERENCES public.medical_repass_rules(id) ON DELETE SET NULL,
  rule_snapshot JSONB NOT NULL,
  calculated_amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_medical_repass_items_clinic ON public.medical_repass_items(clinic_id);
CREATE INDEX idx_medical_repass_items_period ON public.medical_repass_items(period_id);
CREATE INDEX idx_medical_repass_items_professional ON public.medical_repass_items(professional_id);
CREATE INDEX idx_medical_repass_items_appointment ON public.medical_repass_items(appointment_id);
CREATE INDEX idx_medical_repass_items_status ON public.medical_repass_items(period_id, status);

-- RLS
ALTER TABLE public.medical_repass_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medical_repass_items_select" ON public.medical_repass_items
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "medical_repass_items_admin" ON public.medical_repass_items
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Trigger para updated_at
CREATE TRIGGER update_medical_repass_items_updated_at
  BEFORE UPDATE ON public.medical_repass_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Pagamentos de Repasse
CREATE TABLE public.medical_repass_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES public.medical_repass_periods(id) ON DELETE RESTRICT,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  total_amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT,
  cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  financial_transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_medical_repass_payments_clinic ON public.medical_repass_payments(clinic_id);
CREATE INDEX idx_medical_repass_payments_period ON public.medical_repass_payments(period_id);
CREATE INDEX idx_medical_repass_payments_professional ON public.medical_repass_payments(professional_id);

-- RLS
ALTER TABLE public.medical_repass_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medical_repass_payments_select" ON public.medical_repass_payments
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "medical_repass_payments_admin" ON public.medical_repass_payments
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Trigger para updated_at
CREATE TRIGGER update_medical_repass_payments_updated_at
  BEFORE UPDATE ON public.medical_repass_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Função para encontrar regra de repasse aplicável
CREATE OR REPLACE FUNCTION public.get_applicable_repass_rule(
  p_clinic_id UUID,
  p_professional_id UUID,
  p_procedure_id UUID DEFAULT NULL,
  p_insurance_plan_id UUID DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  rule_id UUID,
  calculation_type TEXT,
  value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.calculation_type,
    r.value
  FROM public.medical_repass_rules r
  WHERE r.clinic_id = p_clinic_id
    AND r.is_active = true
    AND r.deleted_at IS NULL
    AND r.effective_from <= p_date
    AND (r.effective_until IS NULL OR r.effective_until >= p_date)
    AND (
      r.professional_id = p_professional_id OR r.professional_id IS NULL
    )
    AND (
      r.procedure_id = p_procedure_id OR r.procedure_id IS NULL
    )
    AND (
      r.insurance_plan_id = p_insurance_plan_id OR r.insurance_plan_id IS NULL
    )
  ORDER BY 
    CASE WHEN r.professional_id IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN r.procedure_id IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN r.insurance_plan_id IS NOT NULL THEN 1 ELSE 0 END DESC,
    r.priority DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.medical_repass_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.medical_repass_periods;
ALTER PUBLICATION supabase_realtime ADD TABLE public.medical_repass_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.medical_repass_payments;
