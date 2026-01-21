-- Add cancellation flag to public negotiation previews so public links can be invalidated without querying protected tables
ALTER TABLE public.negotiation_previews
ADD COLUMN IF NOT EXISTS is_cancelled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_negotiation_previews_is_cancelled
ON public.negotiation_previews (is_cancelled);

-- Mark previews as cancelled whenever a negotiation is cancelled
CREATE OR REPLACE FUNCTION public.mark_negotiation_previews_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when status transitions to cancelled
  IF (TG_OP = 'UPDATE') AND (NEW.status = 'cancelled') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.negotiation_previews np
    SET is_cancelled = true,
        cancelled_at = COALESCE(np.cancelled_at, now())
    WHERE np.negotiation_id = NEW.id
       OR np.employer_cnpj = (SELECT e.cnpj FROM public.employers e WHERE e.id = NEW.employer_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_negotiation_previews_cancelled ON public.debt_negotiations;
CREATE TRIGGER trg_mark_negotiation_previews_cancelled
AFTER UPDATE OF status ON public.debt_negotiations
FOR EACH ROW
EXECUTE FUNCTION public.mark_negotiation_previews_cancelled();

-- Backfill: invalidate previews linked to already-cancelled negotiations (including legacy previews via employer_cnpj)
UPDATE public.negotiation_previews np
SET is_cancelled = true,
    cancelled_at = COALESCE(np.cancelled_at, now())
WHERE EXISTS (
  SELECT 1
  FROM public.debt_negotiations dn
  JOIN public.employers e ON e.id = dn.employer_id
  WHERE dn.status = 'cancelled'
    AND (
      np.negotiation_id = dn.id
      OR np.employer_cnpj = e.cnpj
    )
);
