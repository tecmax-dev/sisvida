-- Update existing contributions: if due_date is in the past and status is 'pending', change to 'overdue'
UPDATE public.employer_contributions
SET status = 'overdue', updated_at = now()
WHERE status = 'pending'
  AND due_date < CURRENT_DATE;