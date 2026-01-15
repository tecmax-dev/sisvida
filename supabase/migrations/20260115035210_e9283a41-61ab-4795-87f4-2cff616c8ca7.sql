-- Drop existing policies and recreate with anon access
DROP POLICY IF EXISTS "Anyone can view active convenios" ON public.union_convenios;
DROP POLICY IF EXISTS "Anyone can view active categories" ON public.union_convenio_categories;

-- Allow anon role to read active convenios
CREATE POLICY "Public can view active convenios"
ON public.union_convenios FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Allow anon role to read active categories
CREATE POLICY "Public can view active categories"
ON public.union_convenio_categories FOR SELECT
TO anon, authenticated
USING (is_active = true);