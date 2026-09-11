-- Chave interna para o disparo automático de lembretes (armazenada no cofre)
do $$
declare v_key text;
begin
  if not exists (select 1 from vault.secrets where name = 'REMINDER_CRON_KEY') then
    v_key := encode(gen_random_bytes(32), 'hex');
    perform vault.create_secret(v_key, 'REMINDER_CRON_KEY', 'Chave usada pelo agendador de lembretes de consulta');
  end if;
end $$;

create or replace function public.verify_reminder_cron_key(_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'REMINDER_CRON_KEY' and decrypted_secret = _key
  );
$$;

revoke all on function public.verify_reminder_cron_key(text) from public, anon, authenticated;
grant execute on function public.verify_reminder_cron_key(text) to service_role;