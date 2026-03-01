ALTER TABLE public.union_financial_transactions 
ADD COLUMN IF NOT EXISTS source_statement_tx_id uuid REFERENCES public.union_bank_statement_transactions(id) ON DELETE SET NULL;