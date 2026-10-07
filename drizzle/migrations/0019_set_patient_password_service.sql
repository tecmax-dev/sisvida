CREATE OR REPLACE FUNCTION public.set_patient_password_service(p_patient_id uuid, p_new_password text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF p_new_password IS NULL OR length(p_new_password) < 6 OR length(p_new_password) > 72 THEN RETURN false; END IF;
  UPDATE public.patients SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')), updated_at = now() WHERE id = p_patient_id;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.set_patient_password_service(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_patient_password_service(uuid, text) TO service_role;