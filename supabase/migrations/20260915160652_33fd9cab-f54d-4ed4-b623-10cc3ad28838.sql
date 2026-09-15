CREATE OR REPLACE FUNCTION public.enforce_waiting_list_admin_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / edge functions (auth.uid() IS NULL) are allowed
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Block deactivation (removal) by non-admin users
  IF OLD.is_active IS DISTINCT FROM NEW.is_active AND NEW.is_active = false THEN
    IF NOT (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'owner'::public.app_role)
    ) THEN
      RAISE EXCEPTION 'Somente administradores podem remover pacientes da lista de espera.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_waiting_list_admin_removal ON public.waiting_list;
CREATE TRIGGER trg_waiting_list_admin_removal
BEFORE UPDATE ON public.waiting_list
FOR EACH ROW
EXECUTE FUNCTION public.enforce_waiting_list_admin_removal();