CREATE OR REPLACE FUNCTION public.get_meta_vault_secret(_secret_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','vault'
AS $$
DECLARE v text;
BEGIN
  IF _secret_name <> 'META_WHATSAPP_TOKEN_V2' THEN
    RAISE EXCEPTION 'secret not allowed';
  END IF;
  SELECT decrypted_secret INTO v FROM vault.decrypted_secrets WHERE name = _secret_name;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.get_meta_vault_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_meta_vault_secret(text) TO service_role;