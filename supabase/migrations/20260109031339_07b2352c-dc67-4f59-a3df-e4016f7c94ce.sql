-- Add registration_number column to patients table
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS registration_number TEXT;

-- Create unique index for patients registration_number per clinic
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_registration_clinic 
ON patients(clinic_id, registration_number) 
WHERE registration_number IS NOT NULL AND registration_number != '';

-- Function to generate employer registration number
CREATE OR REPLACE FUNCTION generate_employer_registration_number(p_clinic_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_number integer;
  result text;
BEGIN
  -- Get max numeric registration number for this clinic
  SELECT COALESCE(MAX(CAST(registration_number AS integer)), 0)
  INTO max_number
  FROM employers
  WHERE clinic_id = p_clinic_id
  AND registration_number IS NOT NULL
  AND registration_number ~ '^\d+$';
  
  -- Increment and format with 6 digits
  result := LPAD((max_number + 1)::text, 6, '0');
  RETURN result;
END;
$$;

-- Function to generate patient registration number
CREATE OR REPLACE FUNCTION generate_patient_registration_number(p_clinic_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_number integer;
  result text;
BEGIN
  -- Get max numeric registration number for this clinic
  SELECT COALESCE(MAX(CAST(registration_number AS integer)), 0)
  INTO max_number
  FROM patients
  WHERE clinic_id = p_clinic_id
  AND registration_number IS NOT NULL
  AND registration_number ~ '^\d+$';
  
  -- Increment and format with 6 digits
  result := LPAD((max_number + 1)::text, 6, '0');
  RETURN result;
END;
$$;

-- Update existing employers without registration_number
DO $$
DECLARE
  r RECORD;
  next_num TEXT;
BEGIN
  FOR r IN 
    SELECT id, clinic_id 
    FROM employers 
    WHERE registration_number IS NULL OR registration_number = ''
    ORDER BY created_at
  LOOP
    SELECT generate_employer_registration_number(r.clinic_id) INTO next_num;
    UPDATE employers SET registration_number = next_num WHERE id = r.id;
  END LOOP;
END $$;

-- Update existing patients without registration_number
DO $$
DECLARE
  r RECORD;
  next_num TEXT;
BEGIN
  FOR r IN 
    SELECT id, clinic_id 
    FROM patients 
    WHERE registration_number IS NULL OR registration_number = ''
    ORDER BY created_at
  LOOP
    SELECT generate_patient_registration_number(r.clinic_id) INTO next_num;
    UPDATE patients SET registration_number = next_num WHERE id = r.id;
  END LOOP;
END $$;