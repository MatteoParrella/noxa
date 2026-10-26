-- Funzioni di supporto per i test pgTAP (skill db-migration, DATA_MODEL.md §9).
-- Eseguito per primo e senza rollback: le funzioni restano disponibili agli altri file.
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- uuid di un utente del seed (supabase/seed.sql), letto senza passare dalla RLS.
create or replace function tests.id(nome text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profili p where p.username = nome::extensions.citext;
$$;

-- Impersona un utente del seed come farebbe PostgREST: ruolo authenticated e claim del JWT.
-- Solo `moderatore` ha una sessione con l'autenticazione a due fattori (aal2, R-06).
create or replace function tests.autentica_come(nome text)
returns void
language plpgsql
as $$
declare
  utente uuid := tests.id(nome);
begin
  if utente is null then
    raise exception 'Utente % assente dal seed', nome;
  end if;
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', utente,
      'role', 'authenticated',
      'aal', case when nome = 'moderatore' then 'aal2' else 'aal1' end
    )::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Torna al ruolo postgres, senza utente autenticato.
create or replace function tests.esci()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- uuid di un gruppo per nome (iterazione 7), letto senza passare dalla RLS.
create or replace function tests.gruppo(nome text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.id from public.gruppi g where g.nome = gruppo.nome order by g.creato_il desc limit 1;
$$;

-- uuid di una serata di gruppo per titolo (della serata o dell'evento).
create or replace function tests.serata(titolo text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.serate_gruppo s
  left join public.eventi e on e.id = s.evento_id
  where coalesce(s.titolo, e.titolo) = serata.titolo
  order by s.creata_il desc limit 1;
$$;

-- Amicizia confermata tra due utenti del seed, creata senza passare dalla RLS.
create or replace function tests.rendi_amici(a text, b text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.amicizie (richiedente_id, destinatario_id, canale, stato, accettata_il)
  values (tests.id(a), tests.id(b), 'codice_invito', 'accettata', now());
$$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(6);
select has_function('tests', 'id', array['text'], 'tests.id esiste');
select has_function('tests', 'autentica_come', array['text'], 'tests.autentica_come esiste');
select has_function('tests', 'esci', 'tests.esci esiste');
select has_function('tests', 'gruppo', array['text'], 'tests.gruppo esiste');
select has_function('tests', 'serata', array['text'], 'tests.serata esiste');
select has_function('tests', 'rendi_amici', array['text', 'text'], 'tests.rendi_amici esiste');
select * from finish();
