ALTER TABLE public.union_financial_transactions 
ADD COLUMN IF NOT EXISTS recurrence_type text,
ADD COLUMN IF NOT EXISTS recurrence_source_id uuid REFERENCES public.union_financial_transactions(id);