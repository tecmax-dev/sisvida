-- 1. Fix NEG-2026-00008: set status to completed (all installments are paid)
UPDATE debt_negotiations
SET status = 'completed',
    cancelled_at = NULL,
    cancelled_by = NULL,
    cancellation_reason = NULL,
    updated_at = now()
WHERE id = 'd63cbbce-dcc0-434c-8e55-f452ae6b69c1';

-- 2. Re-link and mark contributions as paid (5 contributions × R$304 = R$1520)
UPDATE employer_contributions
SET negotiation_id = 'd63cbbce-dcc0-434c-8e55-f452ae6b69c1',
    status = 'paid',
    paid_at = '2026-02-27 22:49:57.289+00',
    updated_at = now()
WHERE id IN (
  'a531991c-3124-41fd-a682-109ee1d1faa6',
  '59460425-be0a-4572-9065-7f546cd33383',
  'f5da0719-577b-4e56-979e-24161cd334ff',
  'd8059de5-a734-4c15-babe-8c0c3e9c1ea0',
  'f826f73f-0780-41a5-b278-26b2dd7ce6ab'
);

-- 3. Fix cancel_expired_negotiations to NOT cancel when all installments are paid
CREATE OR REPLACE FUNCTION public.cancel_expired_negotiations()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  cancelled_count INTEGER;
BEGIN
  UPDATE public.debt_negotiations dn
  SET 
    status = 'cancelled',
    updated_at = now()
  WHERE 
    dn.validity_expires_at IS NOT NULL
    AND dn.validity_expires_at < now()
    AND dn.status NOT IN ('cancelled', 'completed', 'paid')
    AND NOT (
      SELECT COALESCE(bool_and(ni.status = 'paid'), false)
      FROM public.negotiation_installments ni
      WHERE ni.negotiation_id = dn.id
    );
  
  GET DIAGNOSTICS cancelled_count = ROW_COUNT;
  
  -- Auto-complete negotiations where all installments are paid
  UPDATE public.debt_negotiations dn
  SET 
    status = 'completed',
    updated_at = now()
  WHERE 
    dn.status NOT IN ('cancelled', 'completed', 'paid')
    AND (
      SELECT COALESCE(bool_and(ni.status = 'paid'), false)
      FROM public.negotiation_installments ni
      WHERE ni.negotiation_id = dn.id
    );
  
  RETURN cancelled_count;
END;
$$;