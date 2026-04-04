
CREATE OR REPLACE FUNCTION validate_patient_card_for_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_valid RECORD;
  v_patient_cpf TEXT;
  v_canonical_patient_id UUID;
  v_msg TEXT;
BEGIN
  IF NEW.status IN ('cancelled', 'completed', 'no_show') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_card_valid FROM is_patient_card_valid(NEW.patient_id, NEW.clinic_id);

  IF v_card_valid.card_number IS NOT NULL AND v_card_valid.is_valid = false THEN
    v_msg := 'CARTEIRINHA_VENCIDA: A carteirinha do paciente (' || v_card_valid.card_number || ') expirou em ' || to_char(v_card_valid.expires_at, 'DD/MM/YYYY') || '. Por favor, renove a carteirinha para agendar.';
    RAISE EXCEPTION '%', v_msg;
  END IF;

  IF v_card_valid.card_number IS NULL THEN
    SELECT cpf INTO v_patient_cpf FROM patients WHERE id = NEW.patient_id;

    IF v_patient_cpf IS NULL OR v_patient_cpf = '' THEN
      SELECT p2.id INTO v_canonical_patient_id
      FROM patients p1
      JOIN patients p2 ON p2.clinic_id = p1.clinic_id
        AND p2.name = p1.name
        AND p2.id != p1.id
        AND p2.cpf IS NOT NULL
        AND p2.cpf != ''
      WHERE p1.id = NEW.patient_id
      LIMIT 1;
    ELSE
      SELECT p2.id INTO v_canonical_patient_id
      FROM patients p2
      WHERE p2.cpf = v_patient_cpf
        AND p2.clinic_id = NEW.clinic_id
        AND p2.id != NEW.patient_id
      LIMIT 1;
    END IF;

    IF v_canonical_patient_id IS NOT NULL THEN
      SELECT * INTO v_card_valid FROM is_patient_card_valid(v_canonical_patient_id, NEW.clinic_id);

      IF v_card_valid.card_number IS NOT NULL AND v_card_valid.is_valid = false THEN
        v_msg := 'CARTEIRINHA_VENCIDA: A carteirinha do paciente (' || v_card_valid.card_number || ') expirou em ' || to_char(v_card_valid.expires_at, 'DD/MM/YYYY') || '. Por favor, renove a carteirinha para agendar.';
        RAISE EXCEPTION '%', v_msg;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
