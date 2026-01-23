-- Permitir todos os tipos de conteúdo usados no app
ALTER TABLE public.union_app_content
  DROP CONSTRAINT IF EXISTS union_app_content_content_type_check;

ALTER TABLE public.union_app_content
  ADD CONSTRAINT union_app_content_content_type_check
  CHECK (
    content_type = ANY (
      ARRAY[
        'banner'::text,
        'convenio'::text,
        'convencao'::text,
        'declaracao'::text,
        'diretoria'::text,
        'documento'::text,
        'galeria'::text,
        'jornal'::text,
        'radio'::text,
        'video'::text,
        'faq'::text,
        'atendimento'::text,
        'sobre'::text
      ]
    )
  );
