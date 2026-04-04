
CREATE TABLE public.whazing_queue_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES public.whazing_queues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(queue_id, user_id)
);

ALTER TABLE public.whazing_queue_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on whazing_queue_users"
  ON public.whazing_queue_users FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view queue assignments"
  ON public.whazing_queue_users FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage queue assignments"
  ON public.whazing_queue_users FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'owner', 'entidade_sindical_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'owner', 'entidade_sindical_admin')
    )
  );

CREATE OR REPLACE FUNCTION public.get_queue_users(p_queue_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  queue_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT qu.id, qu.user_id, COALESCE(p.name, 'Sem nome'), COALESCE(p.email, ''), qu.queue_id, qu.created_at
  FROM public.whazing_queue_users qu
  LEFT JOIN public.profiles p ON p.user_id = qu.user_id
  WHERE qu.queue_id = p_queue_id
  ORDER BY p.name;
$$;

CREATE OR REPLACE FUNCTION public.get_available_users_for_queue(p_clinic_id UUID)
RETURNS TABLE (user_id UUID, user_name TEXT, user_email TEXT, role TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ur.user_id, COALESCE(p.name, 'Sem nome'), COALESCE(p.email, ''), ur.role::TEXT
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.clinic_id = p_clinic_id
  ORDER BY p.name;
$$;

CREATE OR REPLACE FUNCTION public.get_user_queues(p_user_id UUID)
RETURNS TABLE (queue_id UUID, queue_name TEXT, queue_color TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT q.id, q.name, q.color
  FROM public.whazing_queue_users qu
  JOIN public.whazing_queues q ON q.id = qu.queue_id AND q.is_active = true
  WHERE qu.user_id = p_user_id
  ORDER BY q.name;
$$;
