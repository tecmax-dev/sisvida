CREATE OR REPLACE FUNCTION public.check_contribution_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Contribuições sem valor definido devem permanecer aguardando valor
  IF COALESCE(NEW.value, 0) = 0 AND NEW.status IN ('pending', 'overdue') AND NEW.negotiation_id IS NULL THEN
    NEW.status := 'awaiting_value';
  END IF;

  -- Somente marca como vencida quando há valor definido
  IF NEW.status IN ('pending', 'awaiting_value')
     AND COALESCE(NEW.value, 0) > 0
     AND NEW.due_date < CURRENT_DATE
     AND NEW.negotiation_id IS NULL THEN
    NEW.status := 'overdue';
  END IF;

  RETURN NEW;
END;
$$;