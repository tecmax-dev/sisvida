-- Create union_app_content table for managing all mobile app content types
CREATE TABLE public.union_app_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('banner', 'convenio', 'convencao', 'declaracao', 'diretoria', 'documento')),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  file_url TEXT,
  external_link TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX idx_union_app_content_clinic ON public.union_app_content(clinic_id);
CREATE INDEX idx_union_app_content_type ON public.union_app_content(content_type);
CREATE INDEX idx_union_app_content_active ON public.union_app_content(is_active);

-- Enable RLS
ALTER TABLE public.union_app_content ENABLE ROW LEVEL SECURITY;

-- RLS policies for union_app_content - simplified to use existing patterns
CREATE POLICY "Union admins can view app content"
ON public.union_app_content
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR public.has_union_module_access(auth.uid(), clinic_id)
  OR public.has_union_entity_access(auth.uid())
);

CREATE POLICY "Union admins can insert app content"
ON public.union_app_content
FOR INSERT
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.has_union_module_access(auth.uid(), clinic_id)
  OR public.has_union_entity_access(auth.uid())
);

CREATE POLICY "Union admins can update app content"
ON public.union_app_content
FOR UPDATE
USING (
  public.is_super_admin(auth.uid())
  OR public.has_union_module_access(auth.uid(), clinic_id)
  OR public.has_union_entity_access(auth.uid())
);

CREATE POLICY "Union admins can delete app content"
ON public.union_app_content
FOR DELETE
USING (
  public.is_super_admin(auth.uid())
  OR public.has_union_module_access(auth.uid(), clinic_id)
  OR public.has_union_entity_access(auth.uid())
);

-- Create storage bucket for union app content files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('union-app-content', 'union-app-content', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for union-app-content bucket
CREATE POLICY "Authenticated users can upload union app content"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'union-app-content' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view union app content files"
ON storage.objects FOR SELECT
USING (bucket_id = 'union-app-content');

CREATE POLICY "Authenticated users can update union app content files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'union-app-content' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete union app content files"
ON storage.objects FOR DELETE
USING (bucket_id = 'union-app-content' AND auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_union_app_content_updated_at
BEFORE UPDATE ON public.union_app_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();