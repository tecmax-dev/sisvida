-- Tabela de configurações de negociação por clínica/sindicato
CREATE TABLE public.negotiation_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  -- Taxas de juros
  interest_rate_monthly DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  -- Correção monetária (percentual mensal fixo)
  monetary_correction_monthly DECIMAL(5,2) NOT NULL DEFAULT 0.50,
  -- Multa moratória
  late_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 2.00,
  -- Limites de parcelamento
  max_installments INTEGER NOT NULL DEFAULT 12,
  min_installment_value DECIMAL(12,2) NOT NULL DEFAULT 100.00,
  -- Regras adicionais
  allow_partial_negotiation BOOLEAN NOT NULL DEFAULT true,
  require_down_payment BOOLEAN NOT NULL DEFAULT false,
  min_down_payment_percentage DECIMAL(5,2) DEFAULT 10.00,
  -- Texto legal/normativo para o espelho
  legal_basis TEXT,
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(clinic_id)
);

-- Tabela principal de negociações
CREATE TABLE public.debt_negotiations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  -- Código único legível
  negotiation_code TEXT NOT NULL,
  -- Status: simulation, pending_approval, approved, active, completed, cancelled
  status TEXT NOT NULL DEFAULT 'simulation',
  -- Valores consolidados
  total_original_value DECIMAL(12,2) NOT NULL,
  total_interest DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_monetary_correction DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_late_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_negotiated_value DECIMAL(12,2) NOT NULL,
  -- Parcelamento
  down_payment_value DECIMAL(12,2) DEFAULT 0,
  installments_count INTEGER NOT NULL,
  installment_value DECIMAL(12,2) NOT NULL,
  first_due_date DATE NOT NULL,
  -- Taxas aplicadas (snapshot no momento da negociação)
  applied_interest_rate DECIMAL(5,2) NOT NULL,
  applied_correction_rate DECIMAL(5,2) NOT NULL,
  applied_late_fee_rate DECIMAL(5,2) NOT NULL,
  -- Aprovação
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  approval_method TEXT, -- 'presencial', 'portal', 'documento_assinado'
  approval_notes TEXT,
  -- Efetivação
  finalized_at TIMESTAMP WITH TIME ZONE,
  finalized_by UUID,
  -- Cancelamento
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by UUID,
  cancellation_reason TEXT,
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(clinic_id, negotiation_code)
);

-- Itens da negociação (contribuições incluídas)
CREATE TABLE public.negotiation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  negotiation_id UUID NOT NULL REFERENCES public.debt_negotiations(id) ON DELETE CASCADE,
  contribution_id UUID NOT NULL REFERENCES public.employer_contributions(id),
  -- Snapshot dos valores no momento da inclusão
  original_value DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  competence_month INTEGER NOT NULL,
  competence_year INTEGER NOT NULL,
  contribution_type_name TEXT NOT NULL,
  days_overdue INTEGER NOT NULL,
  -- Cálculos individuais
  interest_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  correction_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  late_fee_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_value DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Parcelas da negociação
CREATE TABLE public.negotiation_installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  negotiation_id UUID NOT NULL REFERENCES public.debt_negotiations(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  value DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  -- Status: pending, generated, paid, overdue, cancelled
  status TEXT NOT NULL DEFAULT 'pending',
  -- Dados do boleto (após geração via Lytex)
  lytex_invoice_id TEXT,
  lytex_invoice_url TEXT,
  lytex_boleto_barcode TEXT,
  lytex_boleto_digitable_line TEXT,
  lytex_pix_code TEXT,
  lytex_pix_qrcode TEXT,
  -- Pagamento
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_value DECIMAL(12,2),
  payment_method TEXT,
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(negotiation_id, installment_number)
);

-- Adicionar campo de referência à negociação em employer_contributions
ALTER TABLE public.employer_contributions 
ADD COLUMN IF NOT EXISTS negotiation_id UUID REFERENCES public.debt_negotiations(id);

-- Índices para performance
CREATE INDEX idx_debt_negotiations_clinic ON public.debt_negotiations(clinic_id);
CREATE INDEX idx_debt_negotiations_employer ON public.debt_negotiations(employer_id);
CREATE INDEX idx_debt_negotiations_status ON public.debt_negotiations(status);
CREATE INDEX idx_negotiation_items_negotiation ON public.negotiation_items(negotiation_id);
CREATE INDEX idx_negotiation_items_contribution ON public.negotiation_items(contribution_id);
CREATE INDEX idx_negotiation_installments_negotiation ON public.negotiation_installments(negotiation_id);
CREATE INDEX idx_negotiation_installments_status ON public.negotiation_installments(status);
CREATE INDEX idx_employer_contributions_negotiation ON public.employer_contributions(negotiation_id);

-- Habilitar RLS
ALTER TABLE public.negotiation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negotiation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negotiation_installments ENABLE ROW LEVEL SECURITY;

-- Policies para negotiation_settings
CREATE POLICY "Users can view negotiation settings for their clinic"
  ON public.negotiation_settings FOR SELECT
  USING (
    clinic_id IN (
      SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert negotiation settings for their clinic"
  ON public.negotiation_settings FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update negotiation settings for their clinic"
  ON public.negotiation_settings FOR UPDATE
  USING (
    clinic_id IN (
      SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

-- Policies para debt_negotiations
CREATE POLICY "Users can view negotiations for their clinic"
  ON public.debt_negotiations FOR SELECT
  USING (
    clinic_id IN (
      SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert negotiations for their clinic"
  ON public.debt_negotiations FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update negotiations for their clinic"
  ON public.debt_negotiations FOR UPDATE
  USING (
    clinic_id IN (
      SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

-- Policies para negotiation_items
CREATE POLICY "Users can view negotiation items for their clinic"
  ON public.negotiation_items FOR SELECT
  USING (
    negotiation_id IN (
      SELECT dn.id FROM public.debt_negotiations dn
      WHERE dn.clinic_id IN (
        SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert negotiation items for their clinic"
  ON public.negotiation_items FOR INSERT
  WITH CHECK (
    negotiation_id IN (
      SELECT dn.id FROM public.debt_negotiations dn
      WHERE dn.clinic_id IN (
        SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update negotiation items for their clinic"
  ON public.negotiation_items FOR UPDATE
  USING (
    negotiation_id IN (
      SELECT dn.id FROM public.debt_negotiations dn
      WHERE dn.clinic_id IN (
        SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
      )
    )
  );

-- Policies para negotiation_installments
CREATE POLICY "Users can view negotiation installments for their clinic"
  ON public.negotiation_installments FOR SELECT
  USING (
    negotiation_id IN (
      SELECT dn.id FROM public.debt_negotiations dn
      WHERE dn.clinic_id IN (
        SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert negotiation installments for their clinic"
  ON public.negotiation_installments FOR INSERT
  WITH CHECK (
    negotiation_id IN (
      SELECT dn.id FROM public.debt_negotiations dn
      WHERE dn.clinic_id IN (
        SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update negotiation installments for their clinic"
  ON public.negotiation_installments FOR UPDATE
  USING (
    negotiation_id IN (
      SELECT dn.id FROM public.debt_negotiations dn
      WHERE dn.clinic_id IN (
        SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
      )
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_negotiation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_negotiation_settings_updated_at
  BEFORE UPDATE ON public.negotiation_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_negotiation_updated_at();

CREATE TRIGGER update_debt_negotiations_updated_at
  BEFORE UPDATE ON public.debt_negotiations
  FOR EACH ROW EXECUTE FUNCTION public.update_negotiation_updated_at();

CREATE TRIGGER update_negotiation_installments_updated_at
  BEFORE UPDATE ON public.negotiation_installments
  FOR EACH ROW EXECUTE FUNCTION public.update_negotiation_updated_at();

-- Função para gerar código único de negociação
CREATE OR REPLACE FUNCTION public.generate_negotiation_code(p_clinic_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_count INTEGER;
  v_code TEXT;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.debt_negotiations
  WHERE clinic_id = p_clinic_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
  
  v_code := 'NEG-' || v_year || '-' || LPAD(v_count::TEXT, 5, '0');
  
  RETURN v_code;
END;
$$ LANGUAGE plpgsql SET search_path = public;