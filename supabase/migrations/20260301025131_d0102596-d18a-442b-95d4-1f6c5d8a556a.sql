
-- Drop wrong FK and add correct one for union_bank_statement_imports
ALTER TABLE public.union_bank_statement_imports 
  DROP CONSTRAINT IF EXISTS union_bank_statement_imports_cash_register_id_fkey;

ALTER TABLE public.union_bank_statement_imports
  ADD CONSTRAINT union_bank_statement_imports_cash_register_id_fkey
  FOREIGN KEY (cash_register_id) REFERENCES public.union_cash_registers(id);

-- Drop wrong FK and add correct one for union_bank_statement_transactions
ALTER TABLE public.union_bank_statement_transactions
  DROP CONSTRAINT IF EXISTS union_bank_statement_transactions_cash_register_id_fkey;

ALTER TABLE public.union_bank_statement_transactions
  ADD CONSTRAINT union_bank_statement_transactions_cash_register_id_fkey
  FOREIGN KEY (cash_register_id) REFERENCES public.union_cash_registers(id);
