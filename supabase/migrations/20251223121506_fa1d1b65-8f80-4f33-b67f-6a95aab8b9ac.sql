-- Add exam request fields to document_settings
ALTER TABLE public.document_settings
ADD COLUMN IF NOT EXISTS exam_request_title TEXT DEFAULT 'SOLICITAÇÃO DE EXAMES',
ADD COLUMN IF NOT EXISTS exam_request_template TEXT;