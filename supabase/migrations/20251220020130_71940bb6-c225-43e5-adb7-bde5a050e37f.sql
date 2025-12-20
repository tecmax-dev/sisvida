-- Fix 1: Add DELETE policy for super admins on clinics table
CREATE POLICY "Super admins can delete clinics"
ON clinics FOR DELETE
USING (is_super_admin(auth.uid()));

-- Fix 2: Add DELETE policies for anamnesis tables (cascade delete)
CREATE POLICY "Users can delete anamnesis of their clinics"
ON anamnesis FOR DELETE
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can delete anamnese responses of their clinics"
ON anamnese_responses FOR DELETE
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can delete anamnese answers"
ON anamnese_answers FOR DELETE
USING (EXISTS (
  SELECT 1 FROM anamnese_responses r
  WHERE r.id = anamnese_answers.response_id 
  AND has_clinic_access(auth.uid(), r.clinic_id)
));

-- Feature: Add public token and filled_by_patient columns to anamnese_responses
ALTER TABLE anamnese_responses 
ADD COLUMN IF NOT EXISTS public_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS filled_by_patient BOOLEAN DEFAULT false;

-- Create index for public token lookup
CREATE INDEX IF NOT EXISTS idx_anamnese_responses_public_token 
ON anamnese_responses(public_token);

-- RLS for public access via token (allow viewing and updating by token)
CREATE POLICY "Public can view anamnesis via token"
ON anamnese_responses FOR SELECT
USING (public_token IS NOT NULL);

CREATE POLICY "Public can update anamnesis via token"
ON anamnese_responses FOR UPDATE
USING (public_token IS NOT NULL)
WITH CHECK (true);

-- RLS for anamnese_questions - public can view questions of templates
CREATE POLICY "Public can view questions via template"
ON anamnese_questions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM anamnese_templates t 
  WHERE t.id = anamnese_questions.template_id 
  AND t.is_active = true
));

-- RLS for anamnese_question_options - public can view options
CREATE POLICY "Public can view question options"
ON anamnese_question_options FOR SELECT
USING (EXISTS (
  SELECT 1 FROM anamnese_questions q
  JOIN anamnese_templates t ON t.id = q.template_id
  WHERE q.id = anamnese_question_options.question_id 
  AND t.is_active = true
));

-- RLS for anamnese_answers - public can insert answers via token
CREATE POLICY "Public can insert answers via token"
ON anamnese_answers FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM anamnese_responses r
  WHERE r.id = anamnese_answers.response_id 
  AND r.public_token IS NOT NULL
));

-- Feature: Create prescriptions table for digital prescriptions
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
  medical_record_id UUID REFERENCES medical_records(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_signed BOOLEAN DEFAULT false,
  signed_at TIMESTAMPTZ,
  signature_data TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on prescriptions
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for prescriptions
CREATE POLICY "Users can view prescriptions of their clinics"
ON prescriptions FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage prescriptions of their clinics"
ON prescriptions FOR ALL
USING (has_clinic_access(auth.uid(), clinic_id));

-- Trigger for updated_at
CREATE TRIGGER update_prescriptions_updated_at
  BEFORE UPDATE ON prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();