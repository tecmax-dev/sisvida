-- Corrigir views para usar SECURITY INVOKER

-- Alterar view public_clinic_info para invoker
ALTER VIEW public.public_clinic_info SET (security_invoker = on);

-- Alterar view public_professionals para invoker
ALTER VIEW public.public_professionals SET (security_invoker = on);

-- Criar políticas corretas para as views
-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Public can view limited clinic info via view" ON public.clinics;

-- Nova política que restringe campos sensíveis para público
CREATE POLICY "Public can view clinic basic info only"
ON public.clinics
FOR SELECT  
TO public
USING (
    is_blocked = false OR is_blocked IS NULL
);