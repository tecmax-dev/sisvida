ALTER TABLE public.employer_workers
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inactive_reason text,
  ADD COLUMN IF NOT EXISTS inactive_note text,
  ADD COLUMN IF NOT EXISTS inactive_at timestamptz;