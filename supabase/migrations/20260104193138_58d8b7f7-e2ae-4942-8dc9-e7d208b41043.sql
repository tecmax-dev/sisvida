-- Remove constraint antiga e adiciona nova com awaiting_value
ALTER TABLE public.employer_contributions DROP CONSTRAINT IF EXISTS employer_contributions_status_check;

ALTER TABLE public.employer_contributions ADD CONSTRAINT employer_contributions_status_check 
CHECK (status IN ('pending', 'processing', 'paid', 'overdue', 'cancelled', 'awaiting_value'));