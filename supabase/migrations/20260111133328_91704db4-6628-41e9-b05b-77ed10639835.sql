-- ===============================================
-- FASE 1, 3, 7: MIGRAÇÃO COMPLETA DO GERENCIADOR FINANCEIRO
-- ===============================================

-- ===============================================
-- FASE 1: Validação Obrigatória para Despesas
-- ===============================================

-- Função de validação para despesas (campos obrigatórios)
CREATE OR REPLACE FUNCTION public.validate_expense_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'expense' THEN
    IF NEW.supplier_id IS NULL THEN
      RAISE EXCEPTION 'Fornecedor é obrigatório para despesas';
    END IF;
    IF NEW.cash_register_id IS NULL THEN
      RAISE EXCEPTION 'Portador bancário é obrigatório para despesas';
    END IF;
    IF NEW.due_date IS NULL THEN
      RAISE EXCEPTION 'Data de vencimento é obrigatória para despesas';
    END IF;
    IF NEW.gross_value IS NULL OR NEW.gross_value <= 0 THEN
      RAISE EXCEPTION 'Valor bruto é obrigatório para despesas';
    END IF;
    IF NEW.payment_method IS NULL THEN
      RAISE EXCEPTION 'Forma de pagamento é obrigatória para despesas';
    END IF;
    -- Validate check number when payment method is check
    IF NEW.payment_method = 'check' AND (NEW.check_number IS NULL OR NEW.check_number = '') THEN
      RAISE EXCEPTION 'Número do cheque é obrigatório quando forma de pagamento é cheque';
    END IF;
  END IF;
  
  -- Auto-calculate net value if gross is provided
  IF NEW.gross_value IS NOT NULL THEN
    NEW.net_value := COALESCE(NEW.gross_value, 0) 
                   + COALESCE(NEW.fine_value, 0) 
                   + COALESCE(NEW.interest_value, 0) 
                   - COALESCE(NEW.discount_value, 0) 
                   + COALESCE(NEW.other_values, 0);
    NEW.amount := NEW.net_value;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for expense validation
DROP TRIGGER IF EXISTS trigger_validate_expense ON public.financial_transactions;
CREATE TRIGGER trigger_validate_expense
BEFORE INSERT OR UPDATE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.validate_expense_transaction();

-- ===============================================
-- FASE 3: Histórico de Fluxo de Caixa Completo
-- ===============================================

-- Create cash flow history table
CREATE TABLE IF NOT EXISTS public.cash_flow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'adjustment', 'contribution')),
  source TEXT NOT NULL CHECK (source IN ('transaction', 'contribution', 'transfer', 'manual', 'negotiation')),
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

-- Enable RLS on cash_flow_history
ALTER TABLE public.cash_flow_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cash_flow_history
CREATE POLICY "Users can view clinic cash flow history"
ON public.cash_flow_history
FOR SELECT
TO authenticated
USING (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Super admins can manage all cash flow history"
ON public.cash_flow_history
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Clinic admins can insert cash flow history"
ON public.cash_flow_history
FOR INSERT
TO authenticated
WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cash_flow_history_clinic_date ON public.cash_flow_history(clinic_id, date);
CREATE INDEX IF NOT EXISTS idx_cash_flow_history_register ON public.cash_flow_history(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_history_source ON public.cash_flow_history(source, reference_id);

-- Function to record cash flow entry
CREATE OR REPLACE FUNCTION public.record_cash_flow_entry(
  p_clinic_id UUID,
  p_cash_register_id UUID,
  p_type TEXT,
  p_source TEXT,
  p_reference_id UUID,
  p_reference_type TEXT,
  p_date DATE,
  p_amount NUMERIC,
  p_description TEXT,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
  v_entry_id UUID;
BEGIN
  -- Get current balance of cash register
  SELECT current_balance INTO v_balance_before
  FROM public.cash_registers
  WHERE id = p_cash_register_id;
  
  -- Calculate new balance
  IF p_type IN ('income', 'contribution') THEN
    v_balance_after := COALESCE(v_balance_before, 0) + p_amount;
  ELSE
    v_balance_after := COALESCE(v_balance_before, 0) - p_amount;
  END IF;
  
  -- Insert cash flow entry
  INSERT INTO public.cash_flow_history (
    clinic_id, cash_register_id, type, source, 
    reference_id, reference_type, date, amount,
    balance_before, balance_after, description, created_by
  ) VALUES (
    p_clinic_id, p_cash_register_id, p_type, p_source,
    p_reference_id, p_reference_type, p_date, p_amount,
    v_balance_before, v_balance_after, p_description, p_created_by
  ) RETURNING id INTO v_entry_id;
  
  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ===============================================
-- FASE 7: Sistema de Estorno Controlado
-- ===============================================

-- Add reversal columns to financial_transactions
ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reversed_by UUID,
ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

-- Update status constraint to include 'reversed'
DO $$ BEGIN
  -- Drop existing constraint if exists
  ALTER TABLE public.financial_transactions DROP CONSTRAINT IF EXISTS financial_transactions_status_check;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Create new constraint with all status values
ALTER TABLE public.financial_transactions
ADD CONSTRAINT financial_transactions_status_check 
CHECK (status IN ('pending', 'paid', 'cancelled', 'overdue', 'reversed'));

-- Create function to reverse a transaction
CREATE OR REPLACE FUNCTION public.reverse_transaction(
  p_transaction_id UUID,
  p_reason TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_transaction RECORD;
  v_reversal_amount NUMERIC;
BEGIN
  -- Get transaction details
  SELECT * INTO v_transaction
  FROM public.financial_transactions
  WHERE id = p_transaction_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação não encontrada');
  END IF;
  
  -- Check if transaction is paid (only paid transactions can be reversed)
  IF v_transaction.status != 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas transações pagas podem ser estornadas');
  END IF;
  
  -- Check if already reversed
  IF v_transaction.reversed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação já foi estornada');
  END IF;
  
  -- Update transaction to reversed
  UPDATE public.financial_transactions
  SET 
    status = 'reversed',
    reversed_at = now(),
    reversed_by = COALESCE(p_user_id, auth.uid()),
    reversal_reason = p_reason
  WHERE id = p_transaction_id;
  
  -- Reverse the cash register balance if applicable
  IF v_transaction.cash_register_id IS NOT NULL THEN
    v_reversal_amount := COALESCE(v_transaction.amount, 0);
    
    IF v_transaction.type = 'expense' THEN
      -- Expense was deducted, so add it back
      UPDATE public.cash_registers
      SET current_balance = current_balance + v_reversal_amount,
          updated_at = now()
      WHERE id = v_transaction.cash_register_id;
    ELSIF v_transaction.type = 'income' THEN
      -- Income was added, so deduct it
      UPDATE public.cash_registers
      SET current_balance = current_balance - v_reversal_amount,
          updated_at = now()
      WHERE id = v_transaction.cash_register_id;
    END IF;
    
    -- Record in cash flow history
    PERFORM public.record_cash_flow_entry(
      v_transaction.clinic_id,
      v_transaction.cash_register_id,
      'adjustment',
      'transaction',
      p_transaction_id,
      'reversal',
      CURRENT_DATE,
      v_reversal_amount,
      'Estorno: ' || COALESCE(p_reason, 'Sem motivo informado'),
      COALESCE(p_user_id, auth.uid())
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Transação estornada com sucesso',
    'reversed_amount', v_reversal_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ===============================================
-- Additional Indexes and Views
-- ===============================================

-- Index for reversal queries
CREATE INDEX IF NOT EXISTS idx_transactions_reversed ON public.financial_transactions(reversed_at) WHERE reversed_at IS NOT NULL;

-- Index for status filter
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.financial_transactions(status);

-- Create view for cash flow by cash register (saldo por portador)
CREATE OR REPLACE VIEW public.cash_register_balances AS
SELECT 
  cr.id,
  cr.clinic_id,
  cr.name,
  cr.type,
  cr.bank_name,
  cr.initial_balance,
  cr.current_balance,
  COALESCE(income.total, 0) as total_income,
  COALESCE(expense.total, 0) as total_expense,
  cr.initial_balance + COALESCE(income.total, 0) - COALESCE(expense.total, 0) as calculated_balance
FROM public.cash_registers cr
LEFT JOIN (
  SELECT cash_register_id, SUM(amount) as total
  FROM public.financial_transactions
  WHERE type = 'income' AND status = 'paid'
  GROUP BY cash_register_id
) income ON income.cash_register_id = cr.id
LEFT JOIN (
  SELECT cash_register_id, SUM(amount) as total
  FROM public.financial_transactions
  WHERE type = 'expense' AND status = 'paid'
  GROUP BY cash_register_id
) expense ON expense.cash_register_id = cr.id;

-- Create view for annual cash flow summary
CREATE OR REPLACE VIEW public.annual_cash_flow AS
SELECT 
  clinic_id,
  EXTRACT(YEAR FROM due_date) as year,
  EXTRACT(MONTH FROM due_date) as month,
  SUM(CASE WHEN type = 'income' AND status = 'paid' THEN amount ELSE 0 END) as income,
  SUM(CASE WHEN type = 'expense' AND status = 'paid' THEN amount ELSE 0 END) as expense,
  SUM(CASE WHEN type = 'income' AND status = 'paid' THEN amount ELSE 0 END) - 
  SUM(CASE WHEN type = 'expense' AND status = 'paid' THEN amount ELSE 0 END) as balance,
  SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_total,
  COUNT(*) as transaction_count
FROM public.financial_transactions
WHERE due_date IS NOT NULL AND status != 'cancelled' AND status != 'reversed'
GROUP BY clinic_id, EXTRACT(YEAR FROM due_date), EXTRACT(MONTH FROM due_date)
ORDER BY year DESC, month DESC;

-- Add comments for documentation
COMMENT ON TABLE public.cash_flow_history IS 'Histórico detalhado de movimentações do fluxo de caixa por portador';
COMMENT ON COLUMN public.financial_transactions.reversed_at IS 'Data/hora em que a transação foi estornada';
COMMENT ON COLUMN public.financial_transactions.reversed_by IS 'Usuário que realizou o estorno';
COMMENT ON COLUMN public.financial_transactions.reversal_reason IS 'Motivo do estorno (obrigatório)';