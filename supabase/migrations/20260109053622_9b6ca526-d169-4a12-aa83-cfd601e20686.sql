-- Atualizar função generate_card_number para usar matrícula do paciente
CREATE OR REPLACE FUNCTION public.generate_card_number(p_clinic_id uuid, p_patient_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  patient_registration text;
  next_number integer;
BEGIN
  -- Se patient_id foi fornecido, buscar matrícula do paciente
  IF p_patient_id IS NOT NULL THEN
    SELECT registration_number INTO patient_registration
    FROM patients
    WHERE id = p_patient_id AND clinic_id = p_clinic_id;
    
    -- Se encontrou matrícula válida, retorna ela
    IF patient_registration IS NOT NULL AND patient_registration != '' THEN
      RETURN patient_registration;
    END IF;
  END IF;
  
  -- Fallback: gerar número sequencial (para casos sem matrícula)
  SELECT COALESCE(MAX(
    CASE 
      WHEN card_number ~ '^\d+$' THEN CAST(card_number AS integer)
      ELSE 0 
    END
  ), 0) + 1 INTO next_number
  FROM patient_cards 
  WHERE clinic_id = p_clinic_id;
  
  RETURN LPAD(next_number::text, 6, '0');
END;
$$;

-- Migrar carteirinhas existentes para usar matrícula
UPDATE patient_cards pc
SET card_number = p.registration_number
FROM patients p
WHERE pc.patient_id = p.id
AND pc.is_active = true
AND p.registration_number IS NOT NULL
AND p.registration_number != ''
AND pc.card_number != p.registration_number;