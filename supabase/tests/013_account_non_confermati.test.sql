-- Eliminazione degli account mai confermati dopo 24 ore (SAFETY_PRIVACY.md §10, R-65).
begin;
select plan(6);

create temporary table nuovi (id uuid, email text, creato interval, confermato boolean, username text);
insert into nuovi values
  ('00000000-0000-4000-8000-0000000000c1', 'vecchio@example.com', interval '25 hours', false, 'non.confermato'),
  ('00000000-0000-4000-8000-0000000000c2', 'recente@example.com', interval '2 hours', false, 'appena.iscritto'),
  ('00000000-0000-4000-8000-0000000000c3', 'confermato@example.com', interval '30 days', true, 'gia.confermato');

insert into auth.users (instance_id, id, aud, role, email, created_at, email_confirmed_at, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', n.id, 'authenticated', 'authenticated', n.email,
       now() - n.creato, case when n.confermato then now() - n.creato end,
       jsonb_build_object('username', n.username, 'nome_visualizzato', 'Prova',
         'data_nascita', '2008-01-01',
         'consensi', jsonb_build_object('termini', '2026-10', 'privacy', '2026-11'))
from nuovi n;

select is(private.elimina_account_non_confermati(), 1,
          'R-65: elimina solo l''account non confermato da più di 24 ore');
select is_empty($$ select 1 from auth.users where id = '00000000-0000-4000-8000-0000000000c1' $$,
                'L''account non confermato da 25 ore non esiste più');
select is_empty($$ select 1 from public.profili where id = '00000000-0000-4000-8000-0000000000c1' $$,
                'Con l''account sparisce il profilo e lo username torna libero');
select isnt_empty($$ select 1 from auth.users where id = '00000000-0000-4000-8000-0000000000c2' $$,
                  'Un account non confermato da 2 ore resta: il link si può ancora reinviare');
select isnt_empty($$ select 1 from auth.users where id = '00000000-0000-4000-8000-0000000000c3' $$,
                  'Un account confermato non viene toccato');
select isnt_empty(
  $$ select 1 from cron.job where jobname = 'elimina_account_non_confermati' $$,
  'Il job pg_cron è pianificato'
);

select * from finish();
rollback;
