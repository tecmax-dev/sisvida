
-- When a negotiation is cancelled, unlink contributions so they can be marked overdue again
CREATE OR REPLACE FUNCTION public.unlink_contributions_on_negotiation_cancel()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  -- Only act when status transitions to cancelled
  IF (TG_OP = 'UPDATE') AND (NEW.status = 'cancelled') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Clear negotiation_id and revert pending contributions to overdue if past due
    UPDATE public.employer_contributions
    SET 
      negotiation_id = NULL,
      status = CASE 
        WHEN due_date < CURRENT_DATE AND status NOT IN ('paid', 'cancelled') THEN 'overdue'
        WHEN status NOT IN ('paid', 'cancelled') THEN 'pending'
        ELSE status
      END,
      updated_at = now()
    WHERE negotiation_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_unlink_contributions_on_negotiation_cancel
  AFTER UPDATE ON public.debt_negotiations
  FOR EACH ROW
  EXECUTE FUNCTION public.unlink_contributions_on_negotiation_cancel();

-- Fix existing data: unlink contributions from already-cancelled negotiations
UPDATE public.employer_contributions ec
SET 
  negotiation_id = NULL,
  status = CASE 
    WHEN ec.due_date < CURRENT_DATE AND ec.status NOT IN ('paid', 'cancelled') THEN 'overdue'
    WHEN ec.status NOT IN ('paid', 'cancelled') THEN 'pending'
    ELSE ec.status
  END,
  updated_at = now()
FROM public.debt_negotiations dn
WHERE ec.negotiation_id = dn.id
  AND dn.status = 'cancelled';
