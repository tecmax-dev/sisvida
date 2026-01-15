-- Add new columns to union_convenios for enhanced content editing
ALTER TABLE public.union_convenios
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS instagram TEXT,
ADD COLUMN IF NOT EXISTS facebook TEXT,
ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
ADD COLUMN IF NOT EXISTS street_view_url TEXT,
ADD COLUMN IF NOT EXISTS horario_funcionamento TEXT,
ADD COLUMN IF NOT EXISTS detalhes_extras TEXT;