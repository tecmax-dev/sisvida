REVOKE EXECUTE ON FUNCTION public.get_my_mobile_appointments() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_mobile_appointments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_mobile_appointments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_mobile_appointments() TO service_role;