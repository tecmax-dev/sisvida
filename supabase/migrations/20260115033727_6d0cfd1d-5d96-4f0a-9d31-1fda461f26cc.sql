-- Create table for convenios/partnerships
CREATE TABLE public.union_convenios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT,
  endereco TEXT,
  telefone TEXT,
  desconto TEXT,
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for convenio categories
CREATE TABLE public.union_convenio_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  icon TEXT DEFAULT 'Heart',
  color TEXT DEFAULT 'from-rose-500 to-pink-500',
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add foreign key to link convenios to categories
ALTER TABLE public.union_convenios 
ADD COLUMN category_id UUID REFERENCES public.union_convenio_categories(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.union_convenios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_convenio_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for union_convenios - Allow public read for mobile app
CREATE POLICY "Anyone can view active convenios"
ON public.union_convenios FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage convenios"
ON public.union_convenios FOR ALL
USING (
  clinic_id IN (
    SELECT clinic_id FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
);

-- RLS policies for union_convenio_categories - Allow public read for mobile app
CREATE POLICY "Anyone can view active categories"
ON public.union_convenio_categories FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage categories"
ON public.union_convenio_categories FOR ALL
USING (
  clinic_id IN (
    SELECT clinic_id FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
);

-- Create indexes
CREATE INDEX idx_union_convenios_clinic ON public.union_convenios(clinic_id);
CREATE INDEX idx_union_convenios_category ON public.union_convenios(category_id);
CREATE INDEX idx_union_convenio_categories_clinic ON public.union_convenio_categories(clinic_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.union_convenios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.union_convenio_categories;