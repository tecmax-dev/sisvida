-- Add initial_balance_date column to union_cash_registers
ALTER TABLE public.union_cash_registers 
ADD COLUMN initial_balance_date DATE DEFAULT CURRENT_DATE;