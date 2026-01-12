-- Fix union cash register balance calculation
-- This function recalculates the current_balance based on initial_balance + sum of paid transactions

CREATE OR REPLACE FUNCTION public.recalculate_union_cash_register_balance(register_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_initial_balance NUMERIC;
  v_transactions_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- Get the initial balance
  SELECT initial_balance INTO v_initial_balance
  FROM union_cash_registers
  WHERE id = register_id;

  -- Calculate the sum of all paid transactions (income - expense)
  -- Exclude cancelled and reversed transactions
  SELECT COALESCE(SUM(
    CASE 
      WHEN type = 'income' THEN amount 
      ELSE -amount 
    END
  ), 0) INTO v_transactions_balance
  FROM union_financial_transactions
  WHERE cash_register_id = register_id
  AND status = 'paid';

  v_new_balance := COALESCE(v_initial_balance, 0) + v_transactions_balance;

  -- Update the current balance
  UPDATE union_cash_registers
  SET current_balance = v_new_balance, updated_at = now()
  WHERE id = register_id;

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger function to auto-update balance on transaction changes
CREATE OR REPLACE FUNCTION public.trigger_update_union_cash_register_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT and UPDATE
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.cash_register_id IS NOT NULL THEN
      PERFORM recalculate_union_cash_register_balance(NEW.cash_register_id);
    END IF;
    -- Also recalculate old register if it changed
    IF TG_OP = 'UPDATE' AND OLD.cash_register_id IS NOT NULL AND OLD.cash_register_id != NEW.cash_register_id THEN
      PERFORM recalculate_union_cash_register_balance(OLD.cash_register_id);
    END IF;
    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    IF OLD.cash_register_id IS NOT NULL THEN
      PERFORM recalculate_union_cash_register_balance(OLD.cash_register_id);
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_union_transaction_balance ON union_financial_transactions;

CREATE TRIGGER trigger_union_transaction_balance
AFTER INSERT OR UPDATE OR DELETE ON union_financial_transactions
FOR EACH ROW
EXECUTE FUNCTION trigger_update_union_cash_register_balance();

-- Recalculate all existing balances to fix any inconsistencies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM union_cash_registers WHERE is_active = true
  LOOP
    PERFORM recalculate_union_cash_register_balance(r.id);
  END LOOP;
END $$;

-- Add comment for documentation
COMMENT ON FUNCTION public.recalculate_union_cash_register_balance(UUID) IS 
'Recalculates the current_balance of a union cash register based on initial_balance + sum of paid transactions';

COMMENT ON FUNCTION public.trigger_update_union_cash_register_balance() IS 
'Trigger function that automatically recalculates union cash register balance when transactions change';