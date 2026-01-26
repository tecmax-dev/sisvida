-- RPC para resolver professionals no backend, evitando falhas silenciosas de RLS no mobile
create or replace function get_available_professionals_for_patient(p_patient_id uuid)
returns table (
  id uuid,
  name text,
  specialty text,
  appointment_duration integer,
  avatar_url text,
  clinic_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    p.id,
    p.name,
    p.specialty,
    p.appointment_duration,
    p.avatar_url,
    p.clinic_id
  from patient_cards pc
  join professionals p on p.clinic_id = pc.clinic_id
  where pc.patient_id = p_patient_id
    and pc.is_active = true
    and p.is_active = true;
end;
$$;

-- Permitir execução para anon (mobile)
grant execute on function get_available_professionals_for_patient(uuid) to anon;
grant execute on function get_available_professionals_for_patient(uuid) to authenticated;