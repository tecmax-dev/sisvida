-- Create private bucket for patient signatures
insert into storage.buckets (id, name, public)
values ('patient-signatures', 'patient-signatures', false)
on conflict (id) do nothing;

-- Allow authenticated clinic admins/super admins to read signatures
-- Path convention: <clinic_id>/<patient_id>/signature-<timestamp>.png
create policy "Clinic admins can read patient signatures"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'patient-signatures'
  and (
    public.is_super_admin()
    or public.is_clinic_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
