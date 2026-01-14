-- Create storage bucket for dependent documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('dependent-documents', 'dependent-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for dependent documents
CREATE POLICY "Anyone can upload dependent documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'dependent-documents');

CREATE POLICY "Authenticated users can view dependent documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'dependent-documents');

CREATE POLICY "Admins can manage dependent documents"
ON storage.objects FOR ALL
USING (bucket_id = 'dependent-documents' AND EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role IN ('admin', 'owner')
));

-- Create RPC for mobile dependent inclusion request (bypasses RLS)
CREATE OR REPLACE FUNCTION public.request_dependent_inclusion(
  p_patient_id uuid,
  p_clinic_id uuid,
  p_name text,
  p_cpf text,
  p_birth_date date,
  p_phone text,
  p_relationship text,
  p_cpf_photo_url text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dependent_id uuid;
  v_age integer;
BEGIN
  -- Validate relationship and age for children
  IF p_relationship = 'child' THEN
    v_age := DATE_PART('year', AGE(CURRENT_DATE, p_birth_date));
    IF v_age > 21 THEN
      RAISE EXCEPTION 'Filhos devem ter até 21 anos de idade';
    END IF;
  END IF;

  -- Check if CPF already exists for this clinic
  IF EXISTS (
    SELECT 1 FROM patient_dependents
    WHERE clinic_id = p_clinic_id
    AND cpf = p_cpf
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'CPF já cadastrado como dependente nesta clínica';
  END IF;

  -- Insert the dependent with pending_approval = true
  INSERT INTO patient_dependents (
    clinic_id,
    patient_id,
    name,
    cpf,
    birth_date,
    phone,
    relationship,
    cpf_photo_url,
    is_active,
    pending_approval
  )
  VALUES (
    p_clinic_id,
    p_patient_id,
    p_name,
    p_cpf,
    p_birth_date,
    p_phone,
    p_relationship,
    p_cpf_photo_url,
    true,
    true
  )
  RETURNING id INTO v_dependent_id;

  RETURN v_dependent_id;
END;
$$;

-- Grant execute to anon and authenticated (mobile uses anon calls)
GRANT EXECUTE ON FUNCTION public.request_dependent_inclusion TO anon, authenticated;