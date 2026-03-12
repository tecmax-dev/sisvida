UPDATE employer_contributions 
SET due_date = '2026-03-17', updated_at = now() 
WHERE due_date = '2026-03-10' 
AND (value = 0 OR value IS NULL) 
AND status != 'cancelled';