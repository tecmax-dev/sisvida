
-- Fix 1: Employers - Replace blanket public read with scoped function
DROP POLICY IF EXISTS "Public can verify employer exists for filiacao" ON public.employers;

-- Create a security definer function for public employer verification
CREATE OR REPLACE FUNCTION public.verify_employer_for_filiacao(_employer_id uuid)
RETURNS TABLE(id uuid, name text, trade_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.name, e.trade_name
  FROM public.employers e
  WHERE e.id = _employer_id AND e.is_active = true
  LIMIT 1;
$$;

-- Grant execute to anon for the public affiliation form
GRANT EXECUTE ON FUNCTION public.verify_employer_for_filiacao(uuid) TO anon, authenticated;

-- Also need a way for the affiliation form to list employers for selection
-- Create a function that returns only id+name (no sensitive data)
CREATE OR REPLACE FUNCTION public.list_employers_for_filiacao(_clinic_id uuid)
RETURNS TABLE(id uuid, name text, trade_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.name, e.trade_name
  FROM public.employers e
  WHERE e.clinic_id = _clinic_id AND e.is_active = true
  ORDER BY e.name;
$$;

GRANT EXECUTE ON FUNCTION public.list_employers_for_filiacao(uuid) TO anon, authenticated;

-- Fix 2: Mercado Pago - Remove unauthenticated update policy
DROP POLICY IF EXISTS "Webhook can update payment status" ON public.mercado_pago_payments;

-- Only service_role can update payment status (from edge function after webhook verification)
CREATE POLICY "Service role can update payment status"
  ON public.mercado_pago_payments FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Fix 3: Union albums - Replace unscoped management with clinic-scoped
DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar álbuns" ON public.union_app_albums;

CREATE POLICY "Clinic members can manage union albums"
  ON public.union_app_albums FOR ALL
  TO authenticated
  USING (has_union_module_access(auth.uid(), clinic_id))
  WITH CHECK (has_union_module_access(auth.uid(), clinic_id));

-- Fix 4: Union album photos - Replace unscoped management with clinic-scoped
DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar fotos" ON public.union_app_album_photos;

CREATE POLICY "Clinic members can manage union album photos"
  ON public.union_app_album_photos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.union_app_albums a
      WHERE a.id = album_id
      AND has_union_module_access(auth.uid(), a.clinic_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.union_app_albums a
      WHERE a.id = album_id
      AND has_union_module_access(auth.uid(), a.clinic_id)
    )
  );
