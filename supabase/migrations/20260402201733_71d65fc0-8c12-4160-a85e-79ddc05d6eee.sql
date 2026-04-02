ALTER TABLE public.union_bank_statement_transactions 
  ADD COLUMN IF NOT EXISTS matched_transfer_id uuid,
  ADD COLUMN IF NOT EXISTS matched_type text NOT NULL DEFAULT 'transaction';