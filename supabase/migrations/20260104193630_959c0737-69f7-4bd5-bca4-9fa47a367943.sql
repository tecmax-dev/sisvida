-- Remove constraint antiga de value e adiciona nova com regra condicional
ALTER TABLE public.employer_contributions DROP CONSTRAINT IF EXISTS employer_contributions_value_check;

ALTER TABLE public.employer_contributions ADD CONSTRAINT employer_contributions_value_check 
CHECK (
  (status = 'awaiting_value' AND value = 0)
  OR
  (status <> 'awaiting_value' AND value > 0)
);