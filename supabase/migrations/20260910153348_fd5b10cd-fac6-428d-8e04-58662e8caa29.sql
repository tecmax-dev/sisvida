create or replace function public.is_current_patient(p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'patient_id') = p_patient_id::text
    or (auth.jwt() -> 'user_metadata' ->> 'patient_id') = p_patient_id::text
    or exists (
      select 1
      from auth.users u
      where u.id = auth.uid()
        and (
          (u.raw_app_meta_data ->> 'patient_id') = p_patient_id::text
          or (u.raw_user_meta_data ->> 'patient_id') = p_patient_id::text
          or lower(u.email) = 'patient.' || lower(p_patient_id::text) || '@patients.app.internal'
        )
    ),
    false
  )
$$;