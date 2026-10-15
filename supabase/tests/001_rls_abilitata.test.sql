-- Regole trasversali del database: RLS su ogni tabella di public (R-68), nessun accesso
-- anonimo allo schema private (R-07), ruolo del worker senza privilegi (ADR-0003).
-- Il controllo statico che ogni tabella abbia un file di test è in
-- scripts/verifica_migrazioni.py.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select is_empty(
  $$ select format('%I.%I', n.nspname, c.relname)
     from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'R-68: ogni tabella di public ha la RLS abilitata'
);

select is_empty(
  $$ select format('%I.%I', n.nspname, c.relname)
     from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'v'
       and not coalesce(c.reloptions @> array['security_invoker=true'], false) $$,
  'R-68: ogni vista di public è security_invoker ed eredita la RLS delle tabelle'
);

select is_empty(
  $$ select format('%I.%I', n.nspname, c.relname)
     from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'm' $$,
  'R-68: nessuna vista materializzata in public (non è soggetta alla RLS)'
);

select has_schema('private', 'Lo schema private esiste');

select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'R-07: il ruolo anon non usa lo schema private'
);

select ok(
  (select not rolbypassrls and not rolsuper and not rolcreaterole and not rolcreatedb
   from pg_catalog.pg_roles where rolname = 'noxa_worker'),
  'ADR-0003: noxa_worker non aggira la RLS e non ha privilegi amministrativi'
);

select is_empty(
  $$ select format('%I.%I', table_schema, table_name)
     from information_schema.role_table_grants
     where grantee = 'noxa_worker' and table_schema not in ('public') $$,
  'ADR-0003: noxa_worker ha permessi solo su tabelle di public'
);

select has_extension('postgis', 'PostGIS installata');

select ok(
  (select count(*) = 3 from pg_catalog.pg_extension
   where extname in ('citext', 'pg_cron', 'pg_net')),
  'Estensioni citext, pg_cron e pg_net installate'
);

select * from finish();
rollback;
