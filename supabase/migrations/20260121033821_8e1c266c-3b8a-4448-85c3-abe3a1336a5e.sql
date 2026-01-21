-- Add validity field to debt_negotiations table
ALTER TABLE public.debt_negotiations
ADD COLUMN IF NOT EXISTS validity_expires_at TIMESTAMP WITH TIME ZONE;

-- Add comment explaining the field
COMMENT ON COLUMN public.debt_negotiations.validity_expires_at IS 'Date when the negotiation conditions expire. After this date, the negotiation is automatically cancelled.';

-- Create function to cancel expired negotiations
CREATE OR REPLACE FUNCTION public.cancel_expired_negotiations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cancelled_count INTEGER;
BEGIN
  UPDATE public.debt_negotiations
  SET 
    status = 'cancelled',
    updated_at = now()
  WHERE 
    validity_expires_at IS NOT NULL
    AND validity_expires_at < now()
    AND status NOT IN ('cancelled', 'completed', 'paid');
  
  GET DIAGNOSTICS cancelled_count = ROW_COUNT;
  
  RETURN cancelled_count;
END;
$$;