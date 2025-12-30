-- Add appointment_id column to medical_documents for linking exam requests to appointments
ALTER TABLE public.medical_documents
ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;

-- Create unique index for upsert operations with appointment_id and document_type
CREATE UNIQUE INDEX IF NOT EXISTS medical_documents_appointment_id_document_type_unique 
ON public.medical_documents(appointment_id, document_type) 
WHERE appointment_id IS NOT NULL;