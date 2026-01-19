-- Create a table for CCT categories (for organizing conventions by segment)
CREATE TABLE public.union_cct_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#0d9488',
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.union_cct_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access using user_roles
CREATE POLICY "Admins can manage CCT categories"
ON public.union_cct_categories
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.clinic_id = union_cct_categories.clinic_id
  )
);

-- Public read access for the mobile app
CREATE POLICY "Public can view active CCT categories"
ON public.union_cct_categories
FOR SELECT
USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_union_cct_categories_updated_at
BEFORE UPDATE ON public.union_cct_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add cct_category_id column to union_app_content for CCT categorization
ALTER TABLE public.union_app_content 
ADD COLUMN cct_category_id UUID REFERENCES public.union_cct_categories(id) ON DELETE SET NULL;