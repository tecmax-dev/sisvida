-- Add signature columns to anamnese_responses
ALTER TABLE public.anamnese_responses 
ADD COLUMN IF NOT EXISTS signature_data TEXT,
ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS responsibility_accepted BOOLEAN DEFAULT FALSE;

-- Create bucket for anamnesis signatures
INSERT INTO storage.buckets (id, name, public)
VALUES ('anamnesis-signatures', 'anamnesis-signatures', false)
ON CONFLICT (id) DO NOTHING;

-- Policy for public upload via token (anyone with the response token can upload)
CREATE POLICY "Public can upload signatures via token"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'anamnesis-signatures');

-- Policy for clinic staff to view signatures
CREATE POLICY "Clinic staff can view signatures"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'anamnesis-signatures' 
  AND EXISTS (
    SELECT 1 FROM anamnese_responses ar
    WHERE ar.signature_data = name
    AND has_clinic_access(auth.uid(), ar.clinic_id)
  )
);

-- Policy for public to view their own signature via token
CREATE POLICY "Public can view own signature"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'anamnesis-signatures'
  AND EXISTS (
    SELECT 1 FROM anamnese_responses ar
    WHERE ar.signature_data = name
    AND ar.public_token IS NOT NULL
  )
);