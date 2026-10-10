CREATE OR REPLACE FUNCTION public.ensure_union_entity_base_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cid uuid;
BEGIN
  IF NEW.clinic_id IS NULL AND NEW.status = 'ativa' THEN
    INSERT INTO public.clinics (name, slug, cnpj, phone, clinic_module_enabled)
    VALUES (COALESCE(NEW.nome_fantasia, NEW.razao_social),
            'sind-' || substr(replace(NEW.id::text,'-',''),1,12),
            NEW.cnpj, NEW.telefone, false)
    RETURNING id INTO _cid;
    NEW.clinic_id := _cid;
    IF NEW.user_id IS NOT NULL THEN
      UPDATE public.user_roles SET clinic_id = _cid
       WHERE user_id = NEW.user_id AND role = 'entidade_sindical_admin' AND clinic_id IS NULL;
      INSERT INTO public.user_roles (user_id, clinic_id, role)
      SELECT NEW.user_id, _cid, 'entidade_sindical_admin'
      WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND clinic_id = _cid);
    END IF;
  END IF;
  RETURN NEW;
END $$;