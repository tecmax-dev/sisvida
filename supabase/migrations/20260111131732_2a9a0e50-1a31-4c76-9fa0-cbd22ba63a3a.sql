-- =====================================================
-- MÓDULO FINANCEIRO SINDICAL COMPLETO
-- Adiciona campos avançados para gestão financeira
-- =====================================================

-- 1. Adicionar campos faltantes na tabela financial_transactions
ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id),
ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'outros',
ADD COLUMN IF NOT EXISTS document_number text,
ADD COLUMN IF NOT EXISTS check_number text,
ADD COLUMN IF NOT EXISTS gross_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS fine_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS interest_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_values numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id),
ADD COLUMN IF NOT EXISTS liquidation_date date,
ADD COLUMN IF NOT EXISTS liquidated_by uuid,
ADD COLUMN IF NOT EXISTS is_conciliated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS conciliated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS conciliated_by uuid;

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_financial_transactions_supplier ON public.financial_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_check_number ON public.financial_transactions(check_number);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_document ON public.financial_transactions(document_number);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_cost_center ON public.financial_transactions(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_due_date ON public.financial_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_status ON public.financial_transactions(status);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type_clinic ON public.financial_transactions(clinic_id, type);

-- 3. Criar tabela de auditoria financeira dedicada
CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  entity_type text NOT NULL, -- 'transaction', 'supplier', 'cash_register', etc.
  entity_id uuid NOT NULL,
  action text NOT NULL, -- 'create', 'update', 'delete', 'liquidate', 'cancel', 'reverse'
  old_data jsonb,
  new_data jsonb,
  amount_before numeric,
  amount_after numeric,
  user_id uuid NOT NULL,
  user_name text,
  ip_address text,
  user_agent text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para auditoria
CREATE INDEX IF NOT EXISTS idx_financial_audit_clinic ON public.financial_audit_logs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_entity ON public.financial_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_date ON public.financial_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_financial_audit_user ON public.financial_audit_logs(user_id);

-- RLS para auditoria financeira
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins can view financial audit logs"
ON public.financial_audit_logs
FOR SELECT
USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can insert financial audit logs"
ON public.financial_audit_logs
FOR INSERT
WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Super admins can manage all financial audit logs"
ON public.financial_audit_logs
FOR ALL
USING (is_super_admin(auth.uid()));

-- 4. Criar view para fluxo de caixa consolidado
CREATE OR REPLACE VIEW public.cash_flow_summary AS
SELECT 
  clinic_id,
  DATE_TRUNC('day', COALESCE(paid_date, due_date)) as movement_date,
  type,
  SUM(CASE WHEN type = 'income' AND status = 'paid' THEN amount ELSE 0 END) as income_paid,
  SUM(CASE WHEN type = 'income' AND status = 'pending' THEN amount ELSE 0 END) as income_pending,
  SUM(CASE WHEN type = 'expense' AND status = 'paid' THEN amount ELSE 0 END) as expense_paid,
  SUM(CASE WHEN type = 'expense' AND status = 'pending' THEN amount ELSE 0 END) as expense_pending,
  COUNT(*) as transaction_count
FROM public.financial_transactions
WHERE status != 'cancelled'
GROUP BY clinic_id, DATE_TRUNC('day', COALESCE(paid_date, due_date)), type;

-- 5. Função para registrar auditoria financeira automaticamente
CREATE OR REPLACE FUNCTION public.log_financial_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_action text;
  v_old_data jsonb;
  v_new_data jsonb;
BEGIN
  v_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_new_data := to_jsonb(NEW);
    
    INSERT INTO public.financial_audit_logs (
      clinic_id, entity_type, entity_id, action, new_data, amount_after, user_id
    ) VALUES (
      NEW.clinic_id, TG_TABLE_NAME, NEW.id, v_action, v_new_data, NEW.amount, v_user_id
    );
    
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Detectar tipo de ação baseado nas mudanças
    IF OLD.status != NEW.status THEN
      IF NEW.status = 'paid' THEN
        v_action := 'liquidate';
      ELSIF NEW.status = 'cancelled' THEN
        v_action := 'cancel';
      ELSE
        v_action := 'update';
      END IF;
    ELSE
      v_action := 'update';
    END IF;
    
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    
    INSERT INTO public.financial_audit_logs (
      clinic_id, entity_type, entity_id, action, old_data, new_data, 
      amount_before, amount_after, user_id
    ) VALUES (
      NEW.clinic_id, TG_TABLE_NAME, NEW.id, v_action, v_old_data, v_new_data, 
      OLD.amount, NEW.amount, v_user_id
    );
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old_data := to_jsonb(OLD);
    
    INSERT INTO public.financial_audit_logs (
      clinic_id, entity_type, entity_id, action, old_data, amount_before, user_id
    ) VALUES (
      OLD.clinic_id, TG_TABLE_NAME, OLD.id, v_action, v_old_data, OLD.amount, v_user_id
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Aplicar trigger de auditoria às transações financeiras
DROP TRIGGER IF EXISTS trigger_financial_transactions_audit ON public.financial_transactions;
CREATE TRIGGER trigger_financial_transactions_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_financial_audit();

-- 7. Função para atualizar saldo do portador bancário automaticamente
CREATE OR REPLACE FUNCTION public.update_cash_register_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando uma transação é paga, atualiza o saldo do portador
  IF NEW.status = 'paid' AND OLD.status != 'paid' AND NEW.cash_register_id IS NOT NULL THEN
    IF NEW.type = 'income' THEN
      UPDATE public.cash_registers 
      SET current_balance = current_balance + NEW.amount,
          updated_at = now()
      WHERE id = NEW.cash_register_id;
    ELSIF NEW.type = 'expense' THEN
      UPDATE public.cash_registers 
      SET current_balance = current_balance - NEW.amount,
          updated_at = now()
      WHERE id = NEW.cash_register_id;
    END IF;
  END IF;
  
  -- Quando uma transação paga é cancelada, reverte o saldo
  IF OLD.status = 'paid' AND NEW.status = 'cancelled' AND OLD.cash_register_id IS NOT NULL THEN
    IF OLD.type = 'income' THEN
      UPDATE public.cash_registers 
      SET current_balance = current_balance - OLD.amount,
          updated_at = now()
      WHERE id = OLD.cash_register_id;
    ELSIF OLD.type = 'expense' THEN
      UPDATE public.cash_registers 
      SET current_balance = current_balance + OLD.amount,
          updated_at = now()
      WHERE id = OLD.cash_register_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Aplicar trigger de atualização de saldo
DROP TRIGGER IF EXISTS trigger_update_cash_register_balance ON public.financial_transactions;
CREATE TRIGGER trigger_update_cash_register_balance
  AFTER UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_cash_register_balance();

-- 9. Constraint para bloquear exclusão de transações pagas
CREATE OR REPLACE FUNCTION public.prevent_paid_transaction_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'paid' THEN
    RAISE EXCEPTION 'Não é permitido excluir transações pagas. Use estorno.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_paid_delete ON public.financial_transactions;
CREATE TRIGGER trigger_prevent_paid_delete
  BEFORE DELETE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_paid_transaction_delete();

-- 10. Adicionar comentários para documentação
COMMENT ON COLUMN public.financial_transactions.supplier_id IS 'Fornecedor vinculado à transação';
COMMENT ON COLUMN public.financial_transactions.document_type IS 'Tipo: nota_fiscal, recibo, boleto, fatura, cupom, outros';
COMMENT ON COLUMN public.financial_transactions.document_number IS 'Número do documento fiscal';
COMMENT ON COLUMN public.financial_transactions.check_number IS 'Número do cheque para pagamentos com cheque';
COMMENT ON COLUMN public.financial_transactions.gross_value IS 'Valor bruto original';
COMMENT ON COLUMN public.financial_transactions.fine_value IS 'Valor de multa';
COMMENT ON COLUMN public.financial_transactions.interest_value IS 'Valor de juros';
COMMENT ON COLUMN public.financial_transactions.discount_value IS 'Valor de desconto';
COMMENT ON COLUMN public.financial_transactions.net_value IS 'Valor líquido final';
COMMENT ON COLUMN public.financial_transactions.cost_center_id IS 'Centro de custo vinculado';
COMMENT ON COLUMN public.financial_transactions.liquidation_date IS 'Data de liquidação/baixa';
COMMENT ON COLUMN public.financial_transactions.is_conciliated IS 'Se foi conciliado com extrato bancário';
COMMENT ON TABLE public.financial_audit_logs IS 'Auditoria completa de operações financeiras';