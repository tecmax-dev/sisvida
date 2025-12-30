
-- Function to sync dependent card expiry with titular
CREATE OR REPLACE FUNCTION public.sync_dependent_card_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When a patient card is created or updated, sync expiry to all their dependents
  UPDATE patient_dependents
  SET card_expires_at = NEW.expires_at
  WHERE patient_id = NEW.patient_id
    AND is_active = true;
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-sync when patient card is inserted or updated
DROP TRIGGER IF EXISTS sync_dependent_card_expiry_trigger ON patient_cards;
CREATE TRIGGER sync_dependent_card_expiry_trigger
  AFTER INSERT OR UPDATE OF expires_at ON patient_cards
  FOR EACH ROW
  EXECUTE FUNCTION sync_dependent_card_expiry();

-- Also create a manual function to sync all dependents for a clinic
CREATE OR REPLACE FUNCTION public.sync_all_dependents_card_expiry(p_clinic_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE patient_dependents pd
  SET card_expires_at = pc.expires_at
  FROM patient_cards pc
  WHERE pd.patient_id = pc.patient_id
    AND pd.clinic_id = p_clinic_id
    AND pd.is_active = true
    AND pc.is_active = true;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
