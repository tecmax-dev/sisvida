
-- Fix function search path
CREATE OR REPLACE FUNCTION public.check_whatsapp_multiattendance_access(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.clinic_addons ca
    JOIN public.subscription_addons sa ON sa.id = ca.addon_id
    WHERE ca.clinic_id = p_clinic_id 
    AND ca.status = 'active'
    AND sa.slug = 'whatsapp-multiattendance'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
