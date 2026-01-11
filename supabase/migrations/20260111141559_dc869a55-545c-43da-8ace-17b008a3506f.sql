-- =====================================================
-- FASE 1: ESTRUTURA DE BANCO DE DADOS DO MÓDULO SINDICAL
-- Tabelas independentes com prefixo union_
-- =====================================================

-- 1. Categorias financeiras sindicais
CREATE TABLE public.union_financial_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  parent_id UUID REFERENCES union_financial_categories(id),
  color TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Centros de custo sindicais
CREATE TABLE public.union_cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  parent_id UUID REFERENCES union_cost_centers(id),
  hierarchy_level INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Fornecedores sindicais
CREATE TABLE public.union_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trade_name TEXT,
  cnpj TEXT,
  cpf TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  contact_name TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Portadores bancários sindicais
CREATE TABLE public.union_cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bank_account', 'cash', 'investment', 'other')),
  bank_name TEXT,
  agency TEXT,
  account_number TEXT,
  initial_balance NUMERIC(12,2) DEFAULT 0,
  current_balance NUMERIC(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Transações financeiras sindicais
CREATE TABLE public.union_financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category_id UUID REFERENCES union_financial_categories(id),
  supplier_id UUID REFERENCES union_suppliers(id),
  cash_register_id UUID REFERENCES union_cash_registers(id),
  cost_center_id UUID REFERENCES union_cost_centers(id),
  employer_id UUID REFERENCES employers(id),
  contribution_id UUID REFERENCES employer_contributions(id),
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  gross_value NUMERIC(12,2) DEFAULT 0,
  fine_value NUMERIC(12,2) DEFAULT 0,
  interest_value NUMERIC(12,2) DEFAULT 0,
  discount_value NUMERIC(12,2) DEFAULT 0,
  net_value NUMERIC(12,2) DEFAULT 0,
  due_date DATE,
  paid_date DATE,
  payment_method TEXT,
  document_type TEXT DEFAULT 'outros',
  document_number TEXT,
  check_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'reversed')),
  reversed_at TIMESTAMPTZ,
  reversed_by UUID,
  reversal_reason TEXT,
  notes TEXT,
  is_conciliated BOOLEAN DEFAULT false,
  conciliated_at TIMESTAMPTZ,
  conciliated_by UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Histórico de fluxo de caixa sindical
CREATE TABLE public.union_cash_flow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  cash_register_id UUID REFERENCES union_cash_registers(id),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'adjustment', 'contribution', 'reversal')),
  source TEXT NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  balance_before NUMERIC(12,2),
  balance_after NUMERIC(12,2),
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Transferências entre contas sindicais
CREATE TABLE public.union_cash_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  from_register_id UUID NOT NULL REFERENCES union_cash_registers(id),
  to_register_id UUID NOT NULL REFERENCES union_cash_registers(id),
  amount NUMERIC(12,2) NOT NULL,
  transfer_date DATE NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Log de auditoria sindical
CREATE TABLE public.union_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX idx_union_financial_transactions_clinic ON union_financial_transactions(clinic_id);
CREATE INDEX idx_union_financial_transactions_type ON union_financial_transactions(type);
CREATE INDEX idx_union_financial_transactions_status ON union_financial_transactions(status);
CREATE INDEX idx_union_financial_transactions_due_date ON union_financial_transactions(due_date);
CREATE INDEX idx_union_financial_transactions_employer ON union_financial_transactions(employer_id);
CREATE INDEX idx_union_suppliers_clinic ON union_suppliers(clinic_id);
CREATE INDEX idx_union_suppliers_cnpj ON union_suppliers(cnpj);
CREATE INDEX idx_union_cash_registers_clinic ON union_cash_registers(clinic_id);
CREATE INDEX idx_union_cash_flow_history_clinic ON union_cash_flow_history(clinic_id);
CREATE INDEX idx_union_cash_flow_history_date ON union_cash_flow_history(date);
CREATE INDEX idx_union_audit_logs_clinic ON union_audit_logs(clinic_id);
CREATE INDEX idx_union_audit_logs_entity ON union_audit_logs(entity_type, entity_id);

-- =====================================================
-- FUNÇÃO: Verificar acesso ao módulo sindical
-- =====================================================

CREATE OR REPLACE FUNCTION public.has_union_module_access(p_user_id UUID, p_clinic_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Super admins sempre têm acesso
  IF is_super_admin(p_user_id) THEN
    RETURN TRUE;
  END IF;
  
  -- Admins da clínica têm acesso
  IF is_clinic_admin(p_user_id, p_clinic_id) THEN
    RETURN TRUE;
  END IF;
  
  -- Verifica permissão específica do módulo sindical
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN access_group_permissions agp ON ur.access_group_id = agp.access_group_id
    WHERE ur.user_id = p_user_id
    AND ur.clinic_id = p_clinic_id
    AND agp.permission_key LIKE 'union_%'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS POLICIES - Todas as tabelas sindicais
-- =====================================================

-- union_financial_categories
ALTER TABLE public.union_financial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view union categories for their clinic"
  ON public.union_financial_categories FOR SELECT
  USING (has_union_module_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage union categories for their clinic"
  ON public.union_financial_categories FOR ALL
  USING (has_union_module_access(auth.uid(), clinic_id))
  WITH CHECK (has_union_module_access(auth.uid(), clinic_id));

-- union_cost_centers
ALTER TABLE public.union_cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view union cost centers for their clinic"
  ON public.union_cost_centers FOR SELECT
  USING (has_union_module_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage union cost centers for their clinic"
  ON public.union_cost_centers FOR ALL
  USING (has_union_module_access(auth.uid(), clinic_id))
  WITH CHECK (has_union_module_access(auth.uid(), clinic_id));

-- union_suppliers
ALTER TABLE public.union_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view union suppliers for their clinic"
  ON public.union_suppliers FOR SELECT
  USING (has_union_module_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage union suppliers for their clinic"
  ON public.union_suppliers FOR ALL
  USING (has_union_module_access(auth.uid(), clinic_id))
  WITH CHECK (has_union_module_access(auth.uid(), clinic_id));

-- union_cash_registers
ALTER TABLE public.union_cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view union cash registers for their clinic"
  ON public.union_cash_registers FOR SELECT
  USING (has_union_module_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage union cash registers for their clinic"
  ON public.union_cash_registers FOR ALL
  USING (has_union_module_access(auth.uid(), clinic_id))
  WITH CHECK (has_union_module_access(auth.uid(), clinic_id));

-- union_financial_transactions
ALTER TABLE public.union_financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view union transactions for their clinic"
  ON public.union_financial_transactions FOR SELECT
  USING (has_union_module_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage union transactions for their clinic"
  ON public.union_financial_transactions FOR ALL
  USING (has_union_module_access(auth.uid(), clinic_id))
  WITH CHECK (has_union_module_access(auth.uid(), clinic_id));

-- union_cash_flow_history
ALTER TABLE public.union_cash_flow_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view union cash flow for their clinic"
  ON public.union_cash_flow_history FOR SELECT
  USING (has_union_module_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage union cash flow for their clinic"
  ON public.union_cash_flow_history FOR ALL
  USING (has_union_module_access(auth.uid(), clinic_id))
  WITH CHECK (has_union_module_access(auth.uid(), clinic_id));

-- union_cash_transfers
ALTER TABLE public.union_cash_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view union transfers for their clinic"
  ON public.union_cash_transfers FOR SELECT
  USING (has_union_module_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage union transfers for their clinic"
  ON public.union_cash_transfers FOR ALL
  USING (has_union_module_access(auth.uid(), clinic_id))
  WITH CHECK (has_union_module_access(auth.uid(), clinic_id));

-- union_audit_logs
ALTER TABLE public.union_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view union audit logs for their clinic"
  ON public.union_audit_logs FOR SELECT
  USING (has_union_module_access(auth.uid(), clinic_id));

CREATE POLICY "System can insert union audit logs"
  ON public.union_audit_logs FOR INSERT
  WITH CHECK (has_union_module_access(auth.uid(), clinic_id));

-- =====================================================
-- TRIGGER: Atualizar saldo do portador após transação
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_union_cash_register_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_amount NUMERIC(12,2);
  v_balance_before NUMERIC(12,2);
  v_balance_after NUMERIC(12,2);
BEGIN
  -- Só processa se houver portador definido e transação paga
  IF NEW.cash_register_id IS NULL OR NEW.status != 'paid' THEN
    RETURN NEW;
  END IF;
  
  -- Pega saldo atual
  SELECT current_balance INTO v_balance_before
  FROM union_cash_registers WHERE id = NEW.cash_register_id;
  
  -- Calcula novo saldo baseado no tipo
  v_amount := COALESCE(NEW.net_value, NEW.amount);
  
  IF NEW.type = 'income' THEN
    v_balance_after := COALESCE(v_balance_before, 0) + v_amount;
  ELSE
    v_balance_after := COALESCE(v_balance_before, 0) - v_amount;
  END IF;
  
  -- Atualiza saldo do portador
  UPDATE union_cash_registers
  SET current_balance = v_balance_after, updated_at = now()
  WHERE id = NEW.cash_register_id;
  
  -- Registra no histórico de fluxo de caixa
  INSERT INTO union_cash_flow_history (
    clinic_id, cash_register_id, type, source, reference_id, reference_type,
    date, amount, balance_before, balance_after, description, created_by
  ) VALUES (
    NEW.clinic_id, NEW.cash_register_id, NEW.type, 'transaction', NEW.id, 'union_financial_transaction',
    COALESCE(NEW.paid_date, CURRENT_DATE), v_amount, v_balance_before, v_balance_after, NEW.description, NEW.created_by
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_union_cash_balance
AFTER INSERT OR UPDATE ON union_financial_transactions
FOR EACH ROW
WHEN (NEW.status = 'paid')
EXECUTE FUNCTION update_union_cash_register_balance();

-- =====================================================
-- TRIGGER: Bloquear exclusão de transações pagas
-- =====================================================

CREATE OR REPLACE FUNCTION public.block_union_paid_transaction_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'paid' THEN
    RAISE EXCEPTION 'Não é possível excluir transações pagas. Utilize o estorno.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_block_union_paid_delete
BEFORE DELETE ON union_financial_transactions
FOR EACH ROW
EXECUTE FUNCTION block_union_paid_transaction_delete();

-- =====================================================
-- TRIGGER: Registrar contribuições pagas no fluxo de caixa sindical
-- =====================================================

CREATE OR REPLACE FUNCTION public.record_contribution_in_union_cash_flow()
RETURNS TRIGGER AS $$
BEGIN
  -- Só registra quando status muda para 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    INSERT INTO union_cash_flow_history (
      clinic_id, type, source, reference_id, reference_type,
      date, amount, description
    ) VALUES (
      NEW.clinic_id, 'contribution', 'employer_contributions', NEW.id, 'contribution',
      COALESCE(NEW.paid_date::date, CURRENT_DATE), NEW.value,
      'Contribuição: Empresa ' || (SELECT trade_name FROM employers WHERE id = NEW.employer_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_contribution_to_union_cash_flow
AFTER INSERT OR UPDATE ON employer_contributions
FOR EACH ROW
EXECUTE FUNCTION record_contribution_in_union_cash_flow();

-- =====================================================
-- FASE 2: PERMISSÕES DO MÓDULO SINDICAL (sem coluna module)
-- =====================================================

INSERT INTO permission_definitions (key, name, description, category) VALUES
  -- Acesso geral
  ('union_module_access', 'Acesso ao Módulo Sindical', 'Permite visualizar o módulo sindical', 'Módulo Sindical'),
  
  -- Empresas
  ('union_view_employers', 'Visualizar Empresas', 'Permite visualizar cadastro de empresas', 'Módulo Sindical'),
  ('union_manage_employers', 'Gerenciar Empresas', 'Permite criar e editar empresas', 'Módulo Sindical'),
  ('union_delete_employers', 'Excluir Empresas', 'Permite excluir empresas', 'Módulo Sindical'),
  
  -- Sócios
  ('union_view_members', 'Visualizar Sócios', 'Permite visualizar sócios/associados', 'Módulo Sindical'),
  ('union_manage_members', 'Gerenciar Sócios', 'Permite criar e editar sócios', 'Módulo Sindical'),
  
  -- Contribuições
  ('union_view_contributions', 'Visualizar Contribuições', 'Permite visualizar contribuições', 'Módulo Sindical'),
  ('union_manage_contributions', 'Gerenciar Contribuições', 'Permite criar e editar contribuições', 'Módulo Sindical'),
  ('union_generate_boletos', 'Gerar Boletos', 'Permite gerar boletos de contribuição', 'Módulo Sindical'),
  ('union_send_boleto_whatsapp', 'Enviar Boleto WhatsApp', 'Permite enviar boletos via WhatsApp', 'Módulo Sindical'),
  ('union_send_boleto_email', 'Enviar Boleto E-mail', 'Permite enviar boletos via e-mail', 'Módulo Sindical'),
  ('union_view_contribution_reports', 'Relatórios de Contribuições', 'Permite visualizar relatórios de contribuições', 'Módulo Sindical'),
  
  -- Financeiro
  ('union_view_financials', 'Visualizar Financeiro Sindical', 'Permite visualizar finanças sindicais', 'Módulo Sindical'),
  ('union_manage_financials', 'Gerenciar Financeiro Sindical', 'Permite gerenciar finanças sindicais', 'Módulo Sindical'),
  ('union_view_expenses', 'Visualizar Despesas', 'Permite visualizar despesas sindicais', 'Módulo Sindical'),
  ('union_manage_expenses', 'Gerenciar Despesas', 'Permite criar e editar despesas', 'Módulo Sindical'),
  ('union_view_income', 'Visualizar Receitas', 'Permite visualizar receitas sindicais', 'Módulo Sindical'),
  ('union_manage_income', 'Gerenciar Receitas', 'Permite criar e editar receitas', 'Módulo Sindical'),
  ('union_view_cash_flow', 'Visualizar Fluxo de Caixa', 'Permite visualizar fluxo de caixa', 'Módulo Sindical'),
  ('union_manage_cash_registers', 'Gerenciar Contas Bancárias', 'Permite gerenciar contas/portadores', 'Módulo Sindical'),
  ('union_manage_suppliers', 'Gerenciar Fornecedores', 'Permite gerenciar fornecedores sindicais', 'Módulo Sindical'),
  ('union_generate_reports', 'Gerar Relatórios Financeiros', 'Permite gerar relatórios financeiros', 'Módulo Sindical'),
  ('union_reversal', 'Estornar Transações', 'Permite estornar transações pagas', 'Módulo Sindical'),
  ('union_manage_categories', 'Gerenciar Categorias', 'Permite gerenciar categorias financeiras', 'Módulo Sindical'),
  ('union_manage_cost_centers', 'Gerenciar Centros de Custo', 'Permite gerenciar centros de custo', 'Módulo Sindical'),
  
  -- Negociações
  ('union_view_negotiations', 'Visualizar Negociações', 'Permite visualizar negociações de débitos', 'Módulo Sindical'),
  ('union_manage_negotiations', 'Gerenciar Negociações', 'Permite criar e editar negociações', 'Módulo Sindical'),
  ('union_approve_negotiations', 'Aprovar Negociações', 'Permite aprovar negociações de débitos', 'Módulo Sindical'),
  ('union_view_agreements', 'Visualizar Acordos', 'Permite visualizar acordos/parcelamentos', 'Módulo Sindical'),
  ('union_view_installments', 'Visualizar Parcelas', 'Permite visualizar parcelas de acordos', 'Módulo Sindical'),
  
  -- Auditoria
  ('union_view_audit', 'Visualizar Auditoria', 'Permite visualizar logs de auditoria sindical', 'Módulo Sindical')
ON CONFLICT (key) DO NOTHING;