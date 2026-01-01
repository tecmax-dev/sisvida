-- Create trigger to sync dependent card expiry when patient card is created/updated
DROP TRIGGER IF EXISTS sync_dependent_card_expiry_trigger ON patient_cards;

CREATE TRIGGER sync_dependent_card_expiry_trigger
AFTER INSERT OR UPDATE OF expires_at ON patient_cards
FOR EACH ROW
EXECUTE FUNCTION sync_dependent_card_expiry();

-- Also sync existing dependents that may be out of sync
UPDATE patient_dependents pd
SET card_expires_at = pc.expires_at
FROM patient_cards pc
WHERE pd.patient_id = pc.patient_id
  AND pd.is_active = true
  AND pc.is_active = true
  AND (pd.card_expires_at IS DISTINCT FROM pc.expires_at);