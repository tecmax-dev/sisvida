-- ================================================================
-- MÓDULO DE PREVISÃO ORÇAMENTÁRIA SINDICAL
-- ================================================================

-- 1. Tabela principal: Exercícios Orçamentários
CREATE TABLE public.union_budget_exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  -- Configuração do período fiscal customizável
  fiscal_year_start_month integer NOT NULL DEFAULT 1, -- 1-12
  fiscal_year_start_day integer NOT NULL DEFAULT 1,   -- 1-31
  start_date date NOT NULL,
  end_date date NOT NULL,
  -- Status do orçamento
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'pending_approval', 'approved', 'revised', 'closed', 'cancelled')),
  -- Parâmetros de projeção
  base_year integer, -- Ano base para projeções
  growth_rate_revenue numeric(5,2) DEFAULT 0, -- % crescimento receitas
  growth_rate_expense numeric(5,2) DEFAULT 0, -- % crescimento despesas
  inflation_rate numeric(5,2) DEFAULT 0, -- % inflação
  base_member_count integer, -- Quantidade base de sócios
  projected_member_count integer, -- Quantidade projetada de sócios
  -- Governança
  created_by uuid REFERENCES auth.users(id),
  approved_at timestamp with time zone,
  closed_at timestamp with time zone,
  notes text,
  -- Auditoria
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Tabela de Aprovadores do Orçamento (Colegiado)
CREATE TABLE public.union_budget_approvers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_exercise_id uuid NOT NULL REFERENCES public.union_budget_exercises(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL CHECK (role IN ('elaborator', 'reviewer', 'approver')),
  is_required boolean NOT NULL DEFAULT true,
  approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'abstained')),
  approved_at timestamp with time zone,
  rejection_reason text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(budget_exercise_id, user_id)
);

-- 3. Tabela de Versões do Orçamento
CREATE TABLE public.union_budget_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_exercise_id uuid NOT NULL REFERENCES public.union_budget_exercises(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  version_name text, -- Ex: "Proposta Inicial", "Revisão Março"
  is_current boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. Tabela de Previsão de Receitas
CREATE TABLE public.union_budget_revenues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_version_id uuid NOT NULL REFERENCES public.union_budget_versions(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.union_financial_categories(id),
  chart_account_id uuid REFERENCES public.union_chart_of_accounts(id),
  cost_center_id uuid REFERENCES public.union_cost_centers(id),
  -- Identificação
  description text NOT NULL,
  revenue_type text NOT NULL CHECK (revenue_type IN ('contribution', 'fee', 'service', 'rental', 'investment', 'grant', 'donation', 'other')),
  -- Valores mensais (12 meses)
  month_01 numeric(15,2) NOT NULL DEFAULT 0,
  month_02 numeric(15,2) NOT NULL DEFAULT 0,
  month_03 numeric(15,2) NOT NULL DEFAULT 0,
  month_04 numeric(15,2) NOT NULL DEFAULT 0,
  month_05 numeric(15,2) NOT NULL DEFAULT 0,
  month_06 numeric(15,2) NOT NULL DEFAULT 0,
  month_07 numeric(15,2) NOT NULL DEFAULT 0,
  month_08 numeric(15,2) NOT NULL DEFAULT 0,
  month_09 numeric(15,2) NOT NULL DEFAULT 0,
  month_10 numeric(15,2) NOT NULL DEFAULT 0,
  month_11 numeric(15,2) NOT NULL DEFAULT 0,
  month_12 numeric(15,2) NOT NULL DEFAULT 0,
  total_amount numeric(15,2) GENERATED ALWAYS AS (month_01 + month_02 + month_03 + month_04 + month_05 + month_06 + month_07 + month_08 + month_09 + month_10 + month_11 + month_12) STORED,
  -- Premissas
  premise_description text, -- Descrição da premissa utilizada
  historical_basis_start_date date, -- Data início do histórico usado
  historical_basis_end_date date,   -- Data fim do histórico usado
  growth_rate_applied numeric(5,2) DEFAULT 0,
  is_recurring boolean NOT NULL DEFAULT true,
  is_locked boolean NOT NULL DEFAULT false, -- Se foi calculado automaticamente
  -- Auditoria
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 5. Tabela de Planejamento de Despesas
CREATE TABLE public.union_budget_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_version_id uuid NOT NULL REFERENCES public.union_budget_versions(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.union_financial_categories(id),
  chart_account_id uuid REFERENCES public.union_chart_of_accounts(id),
  cost_center_id uuid REFERENCES public.union_cost_centers(id),
  supplier_id uuid REFERENCES public.union_suppliers(id),
  -- Identificação
  description text NOT NULL,
  expense_type text NOT NULL CHECK (expense_type IN ('fixed', 'variable', 'recurring', 'eventual', 'investment', 'personnel', 'administrative', 'operational', 'other')),
  expense_nature text CHECK (expense_nature IN ('essential', 'strategic', 'optional')),
  -- Valores mensais (12 meses)
  month_01 numeric(15,2) NOT NULL DEFAULT 0,
  month_02 numeric(15,2) NOT NULL DEFAULT 0,
  month_03 numeric(15,2) NOT NULL DEFAULT 0,
  month_04 numeric(15,2) NOT NULL DEFAULT 0,
  month_05 numeric(15,2) NOT NULL DEFAULT 0,
  month_06 numeric(15,2) NOT NULL DEFAULT 0,
  month_07 numeric(15,2) NOT NULL DEFAULT 0,
  month_08 numeric(15,2) NOT NULL DEFAULT 0,
  month_09 numeric(15,2) NOT NULL DEFAULT 0,
  month_10 numeric(15,2) NOT NULL DEFAULT 0,
  month_11 numeric(15,2) NOT NULL DEFAULT 0,
  month_12 numeric(15,2) NOT NULL DEFAULT 0,
  total_amount numeric(15,2) GENERATED ALWAYS AS (month_01 + month_02 + month_03 + month_04 + month_05 + month_06 + month_07 + month_08 + month_09 + month_10 + month_11 + month_12) STORED,
  -- Limite orçamentário
  budget_limit numeric(15,2), -- Limite máximo permitido
  requires_approval_above numeric(15,2), -- Requer aprovação acima deste valor
  -- Premissas
  premise_description text,
  historical_basis_start_date date,
  historical_basis_end_date date,
  growth_rate_applied numeric(5,2) DEFAULT 0,
  is_recurring boolean NOT NULL DEFAULT true,
  is_locked boolean NOT NULL DEFAULT false,
  -- Auditoria
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 6. Tabela de Configuração de Alertas
CREATE TABLE public.union_budget_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_exercise_id uuid NOT NULL REFERENCES public.union_budget_exercises(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  -- Tipo de alerta
  alert_type text NOT NULL CHECK (alert_type IN ('percentage', 'absolute', 'category')),
  alert_level text NOT NULL CHECK (alert_level IN ('info', 'warning', 'critical')),
  -- Configuração
  threshold_percentage numeric(5,2), -- Para alertas por percentual
  threshold_amount numeric(15,2),    -- Para alertas por valor
  category_id uuid REFERENCES public.union_financial_categories(id), -- Para alertas por categoria
  cost_center_id uuid REFERENCES public.union_cost_centers(id), -- Para alertas por centro de custo
  -- Notificações
  notify_by_email boolean NOT NULL DEFAULT true,
  notify_by_system boolean NOT NULL DEFAULT true,
  notify_users uuid[], -- Lista de usuários a notificar
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 7. Tabela de Alertas Disparados
CREATE TABLE public.union_budget_alert_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES public.union_budget_alerts(id) ON DELETE CASCADE,
  budget_exercise_id uuid NOT NULL REFERENCES public.union_budget_exercises(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  -- Detalhes
  triggered_at timestamp with time zone NOT NULL DEFAULT now(),
  alert_level text NOT NULL,
  message text NOT NULL,
  budget_item_type text, -- 'revenue' ou 'expense'
  budget_item_id uuid,
  current_value numeric(15,2),
  threshold_value numeric(15,2),
  deviation_percentage numeric(5,2),
  -- Status
  acknowledged_at timestamp with time zone,
  acknowledged_by uuid REFERENCES auth.users(id),
  justification text
);

-- 8. Tabela de Execução Orçamentária (Previsto vs Realizado)
CREATE TABLE public.union_budget_execution (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_version_id uuid NOT NULL REFERENCES public.union_budget_versions(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  reference_month integer NOT NULL, -- 1-12
  reference_year integer NOT NULL,
  -- Receitas
  total_revenue_budgeted numeric(15,2) NOT NULL DEFAULT 0,
  total_revenue_realized numeric(15,2) NOT NULL DEFAULT 0,
  revenue_deviation numeric(15,2) GENERATED ALWAYS AS (total_revenue_realized - total_revenue_budgeted) STORED,
  revenue_deviation_percentage numeric(5,2),
  -- Despesas
  total_expense_budgeted numeric(15,2) NOT NULL DEFAULT 0,
  total_expense_realized numeric(15,2) NOT NULL DEFAULT 0,
  expense_deviation numeric(15,2) GENERATED ALWAYS AS (total_expense_realized - total_expense_budgeted) STORED,
  expense_deviation_percentage numeric(5,2),
  -- Resultado
  result_budgeted numeric(15,2) GENERATED ALWAYS AS (total_revenue_budgeted - total_expense_budgeted) STORED,
  result_realized numeric(15,2) GENERATED ALWAYS AS (total_revenue_realized - total_expense_realized) STORED,
  -- Status
  is_closed boolean NOT NULL DEFAULT false,
  closed_at timestamp with time zone,
  closed_by uuid REFERENCES auth.users(id),
  notes text,
  -- Auditoria
  calculated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(budget_version_id, reference_month, reference_year)
);

-- 9. Tabela de Replanejamentos
CREATE TABLE public.union_budget_replanning (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_exercise_id uuid NOT NULL REFERENCES public.union_budget_exercises(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  -- Referência ao item alterado
  item_type text NOT NULL CHECK (item_type IN ('revenue', 'expense')),
  revenue_id uuid REFERENCES public.union_budget_revenues(id),
  expense_id uuid REFERENCES public.union_budget_expenses(id),
  -- Valores
  original_month integer NOT NULL, -- Mês afetado
  original_value numeric(15,2) NOT NULL,
  new_value numeric(15,2) NOT NULL,
  difference numeric(15,2) GENERATED ALWAYS AS (new_value - original_value) STORED,
  -- Justificativa obrigatória
  justification text NOT NULL,
  -- Aprovação
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text
);

-- 10. Tabela de Log de Auditoria do Orçamento
CREATE TABLE public.union_budget_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_exercise_id uuid REFERENCES public.union_budget_exercises(id) ON DELETE SET NULL,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  -- Ação
  action text NOT NULL, -- 'create', 'update', 'delete', 'approve', 'reject', 'close', etc.
  entity_type text NOT NULL, -- Tabela afetada
  entity_id uuid,
  -- Dados
  old_data jsonb,
  new_data jsonb,
  -- Auditoria
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  performed_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

-- ================================================================
-- ÍNDICES PARA PERFORMANCE
-- ================================================================

CREATE INDEX idx_budget_exercises_clinic ON public.union_budget_exercises(clinic_id);
CREATE INDEX idx_budget_exercises_status ON public.union_budget_exercises(status);
CREATE INDEX idx_budget_exercises_dates ON public.union_budget_exercises(start_date, end_date);

CREATE INDEX idx_budget_approvers_exercise ON public.union_budget_approvers(budget_exercise_id);
CREATE INDEX idx_budget_approvers_user ON public.union_budget_approvers(user_id);
CREATE INDEX idx_budget_approvers_status ON public.union_budget_approvers(approval_status);

CREATE INDEX idx_budget_versions_exercise ON public.union_budget_versions(budget_exercise_id);
CREATE INDEX idx_budget_versions_current ON public.union_budget_versions(is_current) WHERE is_current = true;

CREATE INDEX idx_budget_revenues_version ON public.union_budget_revenues(budget_version_id);
CREATE INDEX idx_budget_revenues_clinic ON public.union_budget_revenues(clinic_id);
CREATE INDEX idx_budget_revenues_category ON public.union_budget_revenues(category_id);

CREATE INDEX idx_budget_expenses_version ON public.union_budget_expenses(budget_version_id);
CREATE INDEX idx_budget_expenses_clinic ON public.union_budget_expenses(clinic_id);
CREATE INDEX idx_budget_expenses_category ON public.union_budget_expenses(category_id);

CREATE INDEX idx_budget_alerts_exercise ON public.union_budget_alerts(budget_exercise_id);
CREATE INDEX idx_budget_alerts_active ON public.union_budget_alerts(is_active) WHERE is_active = true;

CREATE INDEX idx_budget_alert_logs_exercise ON public.union_budget_alert_logs(budget_exercise_id);
CREATE INDEX idx_budget_alert_logs_triggered ON public.union_budget_alert_logs(triggered_at);

CREATE INDEX idx_budget_execution_version ON public.union_budget_execution(budget_version_id);
CREATE INDEX idx_budget_execution_period ON public.union_budget_execution(reference_year, reference_month);

CREATE INDEX idx_budget_replanning_exercise ON public.union_budget_replanning(budget_exercise_id);
CREATE INDEX idx_budget_replanning_status ON public.union_budget_replanning(status);

CREATE INDEX idx_budget_audit_logs_exercise ON public.union_budget_audit_logs(budget_exercise_id);
CREATE INDEX idx_budget_audit_logs_performed ON public.union_budget_audit_logs(performed_at);

-- ================================================================
-- RLS POLICIES
-- ================================================================

ALTER TABLE public.union_budget_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_budget_approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_budget_revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_budget_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_budget_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_budget_alert_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_budget_execution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_budget_replanning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_budget_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies para union_budget_exercises
CREATE POLICY "Users can view budget exercises from their clinic" ON public.union_budget_exercises
  FOR SELECT USING (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can insert budget exercises in their clinic" ON public.union_budget_exercises
  FOR INSERT WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can update budget exercises in their clinic" ON public.union_budget_exercises
  FOR UPDATE USING (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can delete draft budget exercises" ON public.union_budget_exercises
  FOR DELETE USING (public.has_clinic_access(auth.uid(), clinic_id) AND status = 'draft');

-- Policies para union_budget_approvers
CREATE POLICY "Users can view budget approvers from their clinic" ON public.union_budget_approvers
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.union_budget_exercises e WHERE e.id = budget_exercise_id AND public.has_clinic_access(auth.uid(), e.clinic_id)));

CREATE POLICY "Users can manage budget approvers" ON public.union_budget_approvers
  FOR ALL USING (EXISTS (SELECT 1 FROM public.union_budget_exercises e WHERE e.id = budget_exercise_id AND public.has_clinic_access(auth.uid(), e.clinic_id)));

-- Policies para union_budget_versions
CREATE POLICY "Users can view budget versions from their clinic" ON public.union_budget_versions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.union_budget_exercises e WHERE e.id = budget_exercise_id AND public.has_clinic_access(auth.uid(), e.clinic_id)));

CREATE POLICY "Users can manage budget versions" ON public.union_budget_versions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.union_budget_exercises e WHERE e.id = budget_exercise_id AND public.has_clinic_access(auth.uid(), e.clinic_id)));

-- Policies para union_budget_revenues
CREATE POLICY "Users can view budget revenues from their clinic" ON public.union_budget_revenues
  FOR SELECT USING (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage budget revenues in their clinic" ON public.union_budget_revenues
  FOR ALL USING (public.has_clinic_access(auth.uid(), clinic_id));

-- Policies para union_budget_expenses
CREATE POLICY "Users can view budget expenses from their clinic" ON public.union_budget_expenses
  FOR SELECT USING (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage budget expenses in their clinic" ON public.union_budget_expenses
  FOR ALL USING (public.has_clinic_access(auth.uid(), clinic_id));

-- Policies para union_budget_alerts
CREATE POLICY "Users can view budget alerts from their clinic" ON public.union_budget_alerts
  FOR SELECT USING (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage budget alerts in their clinic" ON public.union_budget_alerts
  FOR ALL USING (public.has_clinic_access(auth.uid(), clinic_id));

-- Policies para union_budget_alert_logs
CREATE POLICY "Users can view budget alert logs from their clinic" ON public.union_budget_alert_logs
  FOR SELECT USING (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage budget alert logs in their clinic" ON public.union_budget_alert_logs
  FOR ALL USING (public.has_clinic_access(auth.uid(), clinic_id));

-- Policies para union_budget_execution
CREATE POLICY "Users can view budget execution from their clinic" ON public.union_budget_execution
  FOR SELECT USING (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage budget execution in their clinic" ON public.union_budget_execution
  FOR ALL USING (public.has_clinic_access(auth.uid(), clinic_id));

-- Policies para union_budget_replanning
CREATE POLICY "Users can view budget replanning from their clinic" ON public.union_budget_replanning
  FOR SELECT USING (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage budget replanning in their clinic" ON public.union_budget_replanning
  FOR ALL USING (public.has_clinic_access(auth.uid(), clinic_id));

-- Policies para union_budget_audit_logs
CREATE POLICY "Users can view budget audit logs from their clinic" ON public.union_budget_audit_logs
  FOR SELECT USING (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can insert budget audit logs" ON public.union_budget_audit_logs
  FOR INSERT WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));

-- ================================================================
-- TRIGGERS
-- ================================================================

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_budget_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_budget_exercises_timestamp
  BEFORE UPDATE ON public.union_budget_exercises
  FOR EACH ROW EXECUTE FUNCTION public.update_budget_updated_at();

CREATE TRIGGER update_budget_approvers_timestamp
  BEFORE UPDATE ON public.union_budget_approvers
  FOR EACH ROW EXECUTE FUNCTION public.update_budget_updated_at();

CREATE TRIGGER update_budget_revenues_timestamp
  BEFORE UPDATE ON public.union_budget_revenues
  FOR EACH ROW EXECUTE FUNCTION public.update_budget_updated_at();

CREATE TRIGGER update_budget_expenses_timestamp
  BEFORE UPDATE ON public.union_budget_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_budget_updated_at();

CREATE TRIGGER update_budget_alerts_timestamp
  BEFORE UPDATE ON public.union_budget_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_budget_updated_at();

CREATE TRIGGER update_budget_execution_timestamp
  BEFORE UPDATE ON public.union_budget_execution
  FOR EACH ROW EXECUTE FUNCTION public.update_budget_updated_at();

-- Trigger para garantir apenas uma versão atual por exercício
CREATE OR REPLACE FUNCTION public.ensure_single_current_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.union_budget_versions
    SET is_current = false
    WHERE budget_exercise_id = NEW.budget_exercise_id
      AND id != NEW.id
      AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER ensure_single_current_version_trigger
  BEFORE INSERT OR UPDATE ON public.union_budget_versions
  FOR EACH ROW EXECUTE FUNCTION public.ensure_single_current_version();

-- Trigger para log de auditoria automático
CREATE OR REPLACE FUNCTION public.log_budget_exercise_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.union_budget_audit_logs (budget_exercise_id, clinic_id, action, entity_type, entity_id, new_data, performed_by)
    VALUES (NEW.id, NEW.clinic_id, 'create', 'union_budget_exercises', NEW.id, to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.union_budget_audit_logs (budget_exercise_id, clinic_id, action, entity_type, entity_id, old_data, new_data, performed_by)
    VALUES (NEW.id, NEW.clinic_id, 'update', 'union_budget_exercises', NEW.id, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.union_budget_audit_logs (budget_exercise_id, clinic_id, action, entity_type, entity_id, old_data, performed_by)
    VALUES (OLD.id, OLD.clinic_id, 'delete', 'union_budget_exercises', OLD.id, to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER log_budget_exercise_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.union_budget_exercises
  FOR EACH ROW EXECUTE FUNCTION public.log_budget_exercise_changes();