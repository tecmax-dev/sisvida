
-- =====================================================
-- SECURITY FIX: Recriar views com security_invoker=on
-- =====================================================
-- As views foram dropadas na migration anterior mas não recriadas corretamente
-- Vamos verificar se existem e recriar com security_invoker

-- Drop e recria cash_register_balances com security_invoker
DROP VIEW IF EXISTS public.cash_register_balances;
CREATE VIEW public.cash_register_balances
WITH (security_invoker = on)
AS
SELECT cr.id,
    cr.clinic_id,
    cr.name,
    cr.type,
    cr.bank_name,
    cr.initial_balance,
    cr.current_balance,
    COALESCE(income.total, 0::numeric) AS total_income,
    COALESCE(expense.total, 0::numeric) AS total_expense,
    cr.initial_balance + COALESCE(income.total, 0::numeric) - COALESCE(expense.total, 0::numeric) AS calculated_balance
FROM public.cash_registers cr
LEFT JOIN (
    SELECT financial_transactions.cash_register_id,
           sum(financial_transactions.amount) AS total
    FROM public.financial_transactions
    WHERE financial_transactions.type = 'income'::text 
      AND financial_transactions.status = 'paid'::text
    GROUP BY financial_transactions.cash_register_id
) income ON income.cash_register_id = cr.id
LEFT JOIN (
    SELECT financial_transactions.cash_register_id,
           sum(financial_transactions.amount) AS total
    FROM public.financial_transactions
    WHERE financial_transactions.type = 'expense'::text 
      AND financial_transactions.status = 'paid'::text
    GROUP BY financial_transactions.cash_register_id
) expense ON expense.cash_register_id = cr.id;

-- Drop e recria cash_flow_summary com security_invoker
DROP VIEW IF EXISTS public.cash_flow_summary;
CREATE VIEW public.cash_flow_summary
WITH (security_invoker = on)
AS
SELECT clinic_id,
    date_trunc('day'::text, COALESCE(paid_date, due_date)::timestamp with time zone) AS movement_date,
    type,
    sum(CASE WHEN type = 'income'::text AND status = 'paid'::text THEN amount ELSE 0::numeric END) AS income_paid,
    sum(CASE WHEN type = 'income'::text AND status = 'pending'::text THEN amount ELSE 0::numeric END) AS income_pending,
    sum(CASE WHEN type = 'expense'::text AND status = 'paid'::text THEN amount ELSE 0::numeric END) AS expense_paid,
    sum(CASE WHEN type = 'expense'::text AND status = 'pending'::text THEN amount ELSE 0::numeric END) AS expense_pending,
    count(*) AS transaction_count
FROM public.financial_transactions
WHERE status <> 'cancelled'::text
GROUP BY clinic_id, date_trunc('day'::text, COALESCE(paid_date, due_date)::timestamp with time zone), type;

-- Drop e recria annual_cash_flow com security_invoker
DROP VIEW IF EXISTS public.annual_cash_flow;
CREATE VIEW public.annual_cash_flow
WITH (security_invoker = on)
AS
SELECT clinic_id,
    EXTRACT(year FROM due_date) AS year,
    EXTRACT(month FROM due_date) AS month,
    sum(CASE WHEN type = 'income'::text AND status = 'paid'::text THEN amount ELSE 0::numeric END) AS income,
    sum(CASE WHEN type = 'expense'::text AND status = 'paid'::text THEN amount ELSE 0::numeric END) AS expense,
    sum(CASE WHEN type = 'income'::text AND status = 'paid'::text THEN amount ELSE 0::numeric END) - 
    sum(CASE WHEN type = 'expense'::text AND status = 'paid'::text THEN amount ELSE 0::numeric END) AS balance,
    sum(CASE WHEN status = 'pending'::text THEN amount ELSE 0::numeric END) AS pending_total,
    count(*) AS transaction_count
FROM public.financial_transactions
WHERE due_date IS NOT NULL 
  AND status <> 'cancelled'::text 
  AND status <> 'reversed'::text
GROUP BY clinic_id, EXTRACT(year FROM due_date), EXTRACT(month FROM due_date)
ORDER BY EXTRACT(year FROM due_date) DESC, EXTRACT(month FROM due_date) DESC;
