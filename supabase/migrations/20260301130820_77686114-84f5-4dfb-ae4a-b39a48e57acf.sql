
-- Add supplier_id and category_id to union_bank_statement_transactions
-- so users can assign supplier and category directly on OFX lines
ALTER TABLE public.union_bank_statement_transactions
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.union_suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.union_financial_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generated_transaction_id uuid REFERENCES public.union_financial_transactions(id) ON DELETE SET NULL;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_ubst_supplier_id ON public.union_bank_statement_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ubst_generated_tx_id ON public.union_bank_statement_transactions(generated_transaction_id);
