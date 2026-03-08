-- Robust overdue status normalization for employer contributions
-- Rule: unpaid contributions past due date must be overdue (except negotiated records),
-- including rows previously left as awaiting_value when they already have a value.

CREATE OR REPLACE FUNCTION public.check_contribution_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('pending', 'awaiting_value')
     AND COALESCE(NEW.value, 0) > 0
     AND NEW.due_date < CURRENT_DATE
     AND NEW.negotiation_id IS NULL THEN
    NEW.status := 'overdue';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_overdue_contributions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.employer_contributions
  SET status = 'overdue',
      updated_at = now()
  WHERE status IN ('pending', 'awaiting_value')
    AND COALESCE(value, 0) > 0
    AND due_date < CURRENT_DATE
    AND negotiation_id IS NULL;
END;
$function$;

-- One-time backfill to immediately fix existing inconsistent rows
UPDATE public.employer_contributions
SET status = 'overdue',
    updated_at = now()
WHERE status IN ('pending', 'awaiting_value')
  AND COALESCE(value, 0) > 0
  AND due_date < CURRENT_DATE
  AND negotiation_id IS NULL;