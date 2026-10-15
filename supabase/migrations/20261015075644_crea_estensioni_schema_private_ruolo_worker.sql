-- Migrazione: estensioni, schema private e ruolo noxa_worker
-- Documentazione: docs/DATA_MODEL.md §1 e §4; ADR-0002, ADR-0003; regole: R-07, R-68

-- Estensioni nello schema extensions, così nessuna tabella di sistema finisce in public
-- (PostGIS crea spatial_ref_sys nello schema in cui è installato). pg_cron usa lo schema cron,
-- pg_net lo schema net. pgtap si installa solo nei test.
create extension if not exists postgis with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Schema delle funzioni di supporto alle policy (DATA_MODEL.md §4). Non è tra gli schemi
-- esposti dall'API (supabase/config.toml, [api].schemas): le funzioni si raggiungono solo
-- dalle policy, dai trigger e dalle RPC di public.
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
-- Le policy valutate per gli utenti chiamano funzioni private.*: serve l'uso dello schema.
grant usage on schema private to authenticated, service_role;

-- Nessuna funzione di private è eseguibile per default: ogni funzione concede `execute`
-- solo ai ruoli che ne hanno bisogno (skill db-migration).
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from anon;
alter default privileges in schema private revoke execute on functions from authenticated;

-- Ruolo di login del worker (ADR-0003): senza BYPASSRLS e senza password. In locale la
-- password è impostata da supabase/seed.sql; in staging e produzione da un amministratore
-- con `alter role`, conservata solo nei segreti di Fly.io. I permessi sulle tabelle di
-- ingestione arrivano con le migrazioni di quelle tabelle.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'noxa_worker') then
    create role noxa_worker login nobypassrls nocreatedb nocreaterole noinherit;
  end if;
end
$$;
alter role noxa_worker set statement_timeout = '60s';
grant usage on schema public to noxa_worker;
grant usage on schema extensions to noxa_worker;
