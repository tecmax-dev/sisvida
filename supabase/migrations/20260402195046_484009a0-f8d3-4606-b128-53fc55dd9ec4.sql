
ALTER TABLE public.union_cash_transfers
  ADD COLUMN IF NOT EXISTS is_conciliated_from boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_conciliated_to boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conciliated_from_at timestamptz,
  ADD COLUMN IF NOT EXISTS conciliated_to_at timestamptz,
  ADD COLUMN IF NOT EXISTS conciliated_from_by uuid,
  ADD COLUMN IF NOT EXISTS conciliated_to_by uuid,
  ADD COLUMN IF NOT EXISTS source_statement_tx_id_from uuid,
  ADD COLUMN IF NOT EXISTS source_statement_tx_id_to uuid;
