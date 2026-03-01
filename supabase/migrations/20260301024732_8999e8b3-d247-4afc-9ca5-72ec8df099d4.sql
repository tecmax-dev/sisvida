
-- Table for OFX bank statement imports
CREATE TABLE public.union_bank_statement_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id),
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  bank_code TEXT,
  bank_name TEXT,
  account_number TEXT,
  agency TEXT,
  statement_start_date DATE,
  statement_end_date DATE,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  total_credits NUMERIC NOT NULL DEFAULT 0,
  total_debits NUMERIC NOT NULL DEFAULT 0,
  transactions_reconciled INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  imported_by UUID,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table for individual OFX transactions
CREATE TABLE public.union_bank_statement_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id UUID NOT NULL REFERENCES public.union_bank_statement_imports(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id),
  fitid TEXT,
  transaction_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL,
  description TEXT,
  check_number TEXT,
  document_number TEXT,
  reconciliation_status TEXT NOT NULL DEFAULT 'not_identified',
  matched_transaction_id UUID,
  reconciled_by UUID,
  reconciled_at TIMESTAMPTZ,
  reconciliation_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.union_bank_statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_bank_statement_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage bank statement imports"
  ON public.union_bank_statement_imports FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage bank statement transactions"
  ON public.union_bank_statement_transactions FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX idx_union_bsi_clinic ON public.union_bank_statement_imports(clinic_id);
CREATE INDEX idx_union_bsi_hash ON public.union_bank_statement_imports(clinic_id, file_hash);
CREATE INDEX idx_union_bst_import ON public.union_bank_statement_transactions(import_id);
CREATE INDEX idx_union_bst_clinic ON public.union_bank_statement_transactions(clinic_id);
