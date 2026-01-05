-- Drop the existing constraint and create a new one with 'negotiated' status
ALTER TABLE public.employer_contributions DROP CONSTRAINT employer_contributions_status_check;

ALTER TABLE public.employer_contributions ADD CONSTRAINT employer_contributions_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'paid'::text, 'overdue'::text, 'cancelled'::text, 'awaiting_value'::text, 'negotiated'::text]));