-- Drop and recreate the check constraint to include 'ajuda' content type
ALTER TABLE public.union_app_content DROP CONSTRAINT IF EXISTS union_app_content_content_type_check;

ALTER TABLE public.union_app_content ADD CONSTRAINT union_app_content_content_type_check 
CHECK (content_type IN ('banner', 'convenio', 'convencao', 'declaracao', 'diretoria', 'documento', 'galeria', 'jornal', 'radio', 'video', 'faq', 'atendimento', 'sobre', 'ajuda'));