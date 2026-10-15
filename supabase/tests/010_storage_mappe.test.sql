-- Bucket `mappe` (ADR-0016): pubblico in lettura, nessuna scrittura da anon o utenti.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select ok(
  (select public from storage.buckets where id = 'mappe'),
  'Il bucket mappe esiste ed è pubblico in lettura'
);

set local role anon;
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('mappe', 'milano-brianza.pmtiles') $$,
  '42501', null,
  'R-07: anon non può caricare file nel bucket mappe'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('mappe', 'assets/sostituito.pbf') $$,
  '42501', null,
  'Un utente non può caricare file nel bucket mappe'
);
select is_empty(
  $$ update storage.objects set name = 'altro' where bucket_id = 'mappe' returning 1 $$,
  'Un utente non può modificare i file del bucket mappe'
);
reset role;

select * from finish();
rollback;
