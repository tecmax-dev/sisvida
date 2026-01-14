-- Fix trigger function to use paid_at instead of removed/never-existing paid_date
CREATE OR REPLACE FUNCTION public.record_contribution_in_union_cash_flow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só registra quando status muda para 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    INSERT INTO public.union_cash_flow_history (
      clinic_id, type, source, reference_id, reference_type,
      date, amount, description
    ) VALUES (
      NEW.clinic_id,
      'contribution',
      'employer_contributions',
      NEW.id,
      'contribution',
      COALESCE((NEW.paid_at)::date, CURRENT_DATE),
      NEW.value,
      'Contribuição: Empresa ' || (
        SELECT e.trade_name FROM public.employers e WHERE e.id = NEW.employer_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;