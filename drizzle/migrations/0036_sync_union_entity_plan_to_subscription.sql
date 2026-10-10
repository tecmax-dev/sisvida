CREATE OR REPLACE FUNCTION public.sync_union_entity_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.clinic_id IS NOT NULL AND NEW.plan_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.subscriptions WHERE clinic_id = NEW.clinic_id) THEN
      UPDATE public.subscriptions SET plan_id = NEW.plan_id, updated_at = now()
       WHERE clinic_id = NEW.clinic_id AND plan_id IS DISTINCT FROM NEW.plan_id;
    ELSE
      INSERT INTO public.subscriptions (clinic_id, plan_id, status)
      VALUES (NEW.clinic_id, NEW.plan_id, CASE WHEN NEW.status = 'ativa' THEN 'active' ELSE 'trial' END);
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_union_entity_sync_subscription
AFTER INSERT OR UPDATE OF plan_id, clinic_id, status ON public.union_entities
FOR EACH ROW EXECUTE FUNCTION public.sync_union_entity_subscription();

INSERT INTO public.subscriptions (clinic_id, plan_id, status)
SELECT u.clinic_id, u.plan_id, CASE WHEN u.status = 'ativa' THEN 'active' ELSE 'trial' END
FROM public.union_entities u
WHERE u.plan_id IS NOT NULL AND u.clinic_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.clinic_id = u.clinic_id);