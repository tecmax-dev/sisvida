-- Drop the old foreign key constraint
ALTER TABLE public.signature_request_tokens 
DROP CONSTRAINT IF EXISTS signature_request_tokens_associado_id_fkey;

-- Add new foreign key referencing patients table
ALTER TABLE public.signature_request_tokens
ADD CONSTRAINT signature_request_tokens_patient_id_fkey 
FOREIGN KEY (associado_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- Rename column for clarity
ALTER TABLE public.signature_request_tokens 
RENAME COLUMN associado_id TO patient_id;