CREATE OR REPLACE FUNCTION public.upsert_meta_vault_secret(_secret_name text, _secret_value text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
BEGIN
  IF _secret_name <> 'META_WHATSAPP_TOKEN_V2' THEN
    RAISE EXCEPTION 'secret name not allowed';
  END IF;

  INSERT INTO vault.secrets (name, secret)
  VALUES (_secret_name, _secret_value)
  ON CONFLICT (name) DO UPDATE
  SET secret = EXCLUDED.secret;

  RETURN TRUE;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.upsert_meta_vault_secret(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_meta_vault_secret(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_meta_vault_secret(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_meta_vault_secret(text) TO service_role;