-- Migrazione: eliminazione degli account mai confermati
-- Documentazione: docs/DATA_MODEL.md §8; docs/SAFETY_PRIVACY.md §10; regole: R-60, R-65
--
-- Un account che non ha aperto il link di conferma entro 24 ore viene eliminato con il suo
-- profilo (cascata da auth.users): non si conservano dati di chi non ha completato la
-- registrazione e lo username torna libero. Il link vale un'ora e si può reinviare.

create or replace function private.elimina_account_non_confermati()
returns integer
language sql
security definer
set search_path = ''
as $$
  with eliminati as (
    delete from auth.users u
    where u.email_confirmed_at is null
      and u.created_at < now() - interval '24 hours'
    returning 1
  )
  select count(*)::integer from eliminati;
$$;
revoke all on function private.elimina_account_non_confermati() from public, anon, authenticated;

select cron.schedule(
  'elimina_account_non_confermati',
  '17 * * * *',
  $$select private.elimina_account_non_confermati()$$
);
