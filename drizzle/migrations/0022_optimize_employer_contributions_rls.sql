CREATE OR REPLACE FUNCTION public.accessible_clinic_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT clinic_id FROM public.user_roles WHERE user_id = _user_id AND clinic_id IS NOT NULL
  UNION SELECT clinic_id FROM public.professionals WHERE user_id = _user_id AND is_active = true AND clinic_id IS NOT NULL
  UNION SELECT clinic_id FROM public.union_entities WHERE user_id = _user_id AND status = 'ativa' AND clinic_id IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.admin_contribution_clinic_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT clinic_id FROM public.user_roles
  WHERE user_id = _user_id AND clinic_id IS NOT NULL
    AND ((role IN ('owner','admin') AND access_group_id IS NULL) OR role::text = 'entidade_sindical_admin')
$$;

REVOKE EXECUTE ON FUNCTION public.accessible_clinic_ids(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_contribution_clinic_ids(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.accessible_clinic_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_contribution_clinic_ids(uuid) TO authenticated, service_role;

DROP POLICY "Users can view contributions from their clinic" ON public.employer_contributions;
CREATE POLICY "Users can view contributions from their clinic" ON public.employer_contributions
FOR SELECT USING (
  (SELECT public.is_super_admin((SELECT auth.uid())))
  OR clinic_id IN (SELECT public.accessible_clinic_ids((SELECT auth.uid())))
);

DROP POLICY "Admins can manage contributions" ON public.employer_contributions;
CREATE POLICY "Admins can manage contributions" ON public.employer_contributions
FOR ALL USING (
  (SELECT public.is_super_admin((SELECT auth.uid())))
  OR clinic_id IN (SELECT public.admin_contribution_clinic_ids((SELECT auth.uid())))
) WITH CHECK (
  (SELECT public.is_super_admin((SELECT auth.uid())))
  OR clinic_id IN (SELECT public.admin_contribution_clinic_ids((SELECT auth.uid())))
);