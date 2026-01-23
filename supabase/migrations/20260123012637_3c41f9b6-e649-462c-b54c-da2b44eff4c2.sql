-- Tabela de álbuns de fotos
CREATE TABLE public.union_app_albums (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de fotos dos álbuns
CREATE TABLE public.union_app_album_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID NOT NULL REFERENCES public.union_app_albums(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_union_app_albums_clinic ON public.union_app_albums(clinic_id);
CREATE INDEX idx_union_app_albums_active ON public.union_app_albums(is_active);
CREATE INDEX idx_union_app_album_photos_album ON public.union_app_album_photos(album_id);

-- RLS para álbuns
ALTER TABLE public.union_app_albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Álbuns são visíveis publicamente" 
ON public.union_app_albums FOR SELECT USING (true);

CREATE POLICY "Usuários autenticados podem gerenciar álbuns" 
ON public.union_app_albums FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS para fotos
ALTER TABLE public.union_app_album_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fotos são visíveis publicamente" 
ON public.union_app_album_photos FOR SELECT USING (true);

CREATE POLICY "Usuários autenticados podem gerenciar fotos" 
ON public.union_app_album_photos FOR ALL USING (auth.uid() IS NOT NULL);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_union_app_albums_updated_at
BEFORE UPDATE ON public.union_app_albums
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();