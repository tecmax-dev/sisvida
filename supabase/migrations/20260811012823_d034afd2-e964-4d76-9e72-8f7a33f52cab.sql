CREATE OR REPLACE FUNCTION public.set_meta_vault_secret(_secret_name text, _secret_value text, _actor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF _secret_name NOT IN ('META_WHATSAPP_TOKEN_V2', 'META_TEMPLATE_MANAGEMENT_TOKEN') THEN
    RAISE EXCEPTION 'secret not allowed';
  END IF;

  SELECT id INTO v_id FROM vault.secrets WHERE name = _secret_name;

  IF v_id IS NULL THEN
    PERFORM vault.create_secret(_secret_value, _secret_name, 'Meta token');
  ELSE
    PERFORM vault.update_secret(v_id, _secret_value);
  END IF;

  INSERT INTO public.meta_secret_status (secret_name, is_configured, updated_at, updated_by)
  VALUES (_secret_name, true, now(), _actor)
  ON CONFLICT (secret_name) DO UPDATE
    SET is_configured = true, updated_at = now(), updated_by = EXCLUDED.updated_by;
END;
$$;

REVOKE ALL ON FUNCTION public.set_meta_vault_secret(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_meta_vault_secret(text, text, uuid) TO service_role;