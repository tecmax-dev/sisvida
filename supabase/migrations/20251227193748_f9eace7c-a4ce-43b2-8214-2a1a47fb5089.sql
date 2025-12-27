
-- =====================================================
-- FASE 1: Plano de Contas e Centro de Custos
-- =====================================================

-- 1. Plano de Contas Hierárquico
CREATE TABLE public.chart_of_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  hierarchy_level INTEGER NOT NULL DEFAULT 1,
  full_path TEXT,
  is_synthetic BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (clinic_id, account_code)
);

-- Índices para performance
CREATE INDEX idx_chart_of_accounts_clinic ON public.chart_of_accounts(clinic_id);
CREATE INDEX idx_chart_of_accounts_parent ON public.chart_of_accounts(parent_id);
CREATE INDEX idx_chart_of_accounts_type ON public.chart_of_accounts(clinic_id, account_type);
CREATE INDEX idx_chart_of_accounts_active ON public.chart_of_accounts(clinic_id, is_active) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chart_of_accounts_select" ON public.chart_of_accounts
  FOR SELECT USING (
    has_clinic_access(auth.uid(), clinic_id)
    AND (deleted_at IS NULL OR is_super_admin(auth.uid()))
  );

CREATE POLICY "chart_of_accounts_admin" ON public.chart_of_accounts
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Trigger para updated_at
CREATE TRIGGER update_chart_of_accounts_updated_at
  BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Centros de Custo
CREATE TABLE public.cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  hierarchy_level INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (clinic_id, code)
);

-- Índices
CREATE INDEX idx_cost_centers_clinic ON public.cost_centers(clinic_id);
CREATE INDEX idx_cost_centers_parent ON public.cost_centers(parent_id);
CREATE INDEX idx_cost_centers_active ON public.cost_centers(clinic_id, is_active) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cost_centers_select" ON public.cost_centers
  FOR SELECT USING (
    has_clinic_access(auth.uid(), clinic_id)
    AND (deleted_at IS NULL OR is_super_admin(auth.uid()))
  );

CREATE POLICY "cost_centers_admin" ON public.cost_centers
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Trigger para updated_at
CREATE TRIGGER update_cost_centers_updated_at
  BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Rateio de Transações por Centro de Custo
CREATE TABLE public.transaction_cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.financial_transactions(id) ON DELETE CASCADE,
  cost_center_id UUID NOT NULL REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
  account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_transaction_cost_centers_clinic ON public.transaction_cost_centers(clinic_id);
CREATE INDEX idx_transaction_cost_centers_transaction ON public.transaction_cost_centers(transaction_id);
CREATE INDEX idx_transaction_cost_centers_cost_center ON public.transaction_cost_centers(cost_center_id);
CREATE INDEX idx_transaction_cost_centers_account ON public.transaction_cost_centers(account_id);

-- RLS
ALTER TABLE public.transaction_cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transaction_cost_centers_select" ON public.transaction_cost_centers
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "transaction_cost_centers_admin" ON public.transaction_cost_centers
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- 4. Adicionar account_id à tabela financial_transactions
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_account ON public.financial_transactions(account_id);

-- 5. Função para calcular full_path do plano de contas
CREATE OR REPLACE FUNCTION public.update_chart_of_accounts_path()
RETURNS TRIGGER AS $$
DECLARE
  parent_path TEXT;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.full_path := NEW.account_code;
    NEW.hierarchy_level := 1;
  ELSE
    SELECT full_path, hierarchy_level INTO parent_path, NEW.hierarchy_level
    FROM public.chart_of_accounts
    WHERE id = NEW.parent_id;
    
    NEW.full_path := parent_path || ' > ' || NEW.account_code;
    NEW.hierarchy_level := NEW.hierarchy_level + 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER chart_of_accounts_path_trigger
  BEFORE INSERT OR UPDATE OF parent_id, account_code ON public.chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chart_of_accounts_path();

-- 6. Função para calcular hierarchy_level dos centros de custo
CREATE OR REPLACE FUNCTION public.update_cost_center_level()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.hierarchy_level := 1;
  ELSE
    SELECT hierarchy_level + 1 INTO NEW.hierarchy_level
    FROM public.cost_centers
    WHERE id = NEW.parent_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER cost_center_level_trigger
  BEFORE INSERT OR UPDATE OF parent_id ON public.cost_centers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cost_center_level();

-- Habilitar realtime para as novas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE public.chart_of_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cost_centers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transaction_cost_centers;
