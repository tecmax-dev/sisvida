-- Create employer_categories table
CREATE TABLE public.employer_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, name)
);

-- Add category_id to employers table
ALTER TABLE public.employers ADD COLUMN category_id UUID REFERENCES public.employer_categories(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.employer_categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view employer categories from their clinics"
ON public.employer_categories
FOR SELECT
USING (clinic_id IN (SELECT get_user_clinic_ids(auth.uid())));

CREATE POLICY "Users can insert employer categories in their clinics"
ON public.employer_categories
FOR INSERT
WITH CHECK (clinic_id IN (SELECT get_user_clinic_ids(auth.uid())));

CREATE POLICY "Users can update employer categories in their clinics"
ON public.employer_categories
FOR UPDATE
USING (clinic_id IN (SELECT get_user_clinic_ids(auth.uid())));

CREATE POLICY "Users can delete employer categories in their clinics"
ON public.employer_categories
FOR DELETE
USING (clinic_id IN (SELECT get_user_clinic_ids(auth.uid())));

-- Create trigger for updated_at
CREATE TRIGGER update_employer_categories_updated_at
BEFORE UPDATE ON public.employer_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_employers_category_id ON public.employers(category_id);
CREATE INDEX idx_employer_categories_clinic_id ON public.employer_categories(clinic_id);