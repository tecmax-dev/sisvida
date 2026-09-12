create or replace function public.get_appointment_by_confirmation_token(_token text)
returns table (
  id uuid,
  appointment_date date,
  start_time time,
  status text,
  patient_name text,
  professional_name text,
  clinic_name text,
  clinic_address text,
  clinic_phone text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id,
         a.appointment_date,
         a.start_time,
         a.status::text,
         coalesce(d.name, p.name) as patient_name,
         pr.name as professional_name,
         c.name as clinic_name,
         c.address as clinic_address,
         c.phone as clinic_phone
  from public.appointments a
  left join public.patients p on p.id = a.patient_id
  left join public.patient_dependents d on d.id = a.dependent_id
  left join public.professionals pr on pr.id = a.professional_id
  left join public.clinics c on c.id = a.clinic_id
  where _token is not null
    and length(_token) >= 10
    and a.confirmation_token::text = _token
  limit 1;
$$;

grant execute on function public.get_appointment_by_confirmation_token(text) to anon, authenticated;

create or replace function public.act_on_appointment_by_token(_token text, _action text, _reason text default null)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  _appt public.appointments%rowtype;
begin
  if _token is null or length(_token) < 10 then
    return 'INVALID_TOKEN';
  end if;
  if _action not in ('confirm','cancel') then
    return 'INVALID_ACTION';
  end if;

  select * into _appt from public.appointments where confirmation_token::text = _token limit 1;
  if not found then
    return 'NOT_FOUND';
  end if;

  if _appt.status::text in ('cancelled','completed') then
    return 'ALREADY_PROCESSED';
  end if;

  if _action = 'confirm' then
    update public.appointments
      set status = 'confirmed', confirmed_at = now()
      where id = _appt.id;
  else
    update public.appointments
      set status = 'cancelled',
          cancelled_at = now(),
          cancellation_reason = coalesce(nullif(_reason, ''), 'Cancelado pelo paciente via link')
      where id = _appt.id;
  end if;

  return 'OK';
end;
$$;

grant execute on function public.act_on_appointment_by_token(text, text, text) to anon, authenticated;