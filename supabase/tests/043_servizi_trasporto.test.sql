-- servizi_trasporto (DATA_MODEL.md §5.5, F-23, ADR-0034). Regole: R-04 (età calcolata nel
-- database), R-07 (nessun accesso anonimo), R-32 (nessun indirizzo), R-61, R-62.
begin;
select plan(38);

-- ---------------------------------------------------------------------------------------------
-- Struttura
-- ---------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.servizi_trasporto'::regclass),
          'RLS su servizi_trasporto');
select ok(not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'servizi_trasporto'
                        and column_name in ('utente_id', 'posizione', 'indirizzo', 'destinazione')),
          'R-32: nessuna colonna di utenti, posizioni o destinazioni');
select ok(not exists (select 1 from public.servizi_trasporto
                      where tipo = 'app_trasporto' and eta_minima < 18),
          'Le app di trasporto del catalogo richiedono 18 anni');
select ok(not exists (select 1 from public.servizi_trasporto where url !~ '^https://'),
          'Solo link https');
select is((select count(*)::int from public.servizi_trasporto where tipo = 'taxi'), 3,
          'Tre radiotaxi verificati nel catalogo iniziale');

-- Una voce spenta e una per i 16 anni, per provare la policy su ogni età.
insert into public.servizi_trasporto
  (tipo, nome, zona, telefono, url, eta_minima, ordine, fonte_url, verificato_il, attivo)
values
  ('taxi', 'Taxi spento', 'milano', '+39020000', null, 14, 900, 'https://example.org/taxi',
   current_date, false),
  ('app_trasporto', 'App dai sedici', 'tutte', null, 'https://example.org/app', 16, 910,
   'https://example.org/termini', current_date, true);

-- ---------------------------------------------------------------------------------------------
-- Lettura per età (R-04): taxi e mezzi per tutti, app solo dall'età richiesta
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select is((select count(*)::int from public.servizi_trasporto where tipo <> 'app_trasporto'), 4,
          '14 anni: vede mezzi pubblici e taxi');
select is_empty($$ select 1 from public.servizi_trasporto where tipo = 'app_trasporto' $$,
                '14 anni: nessuna app di trasporto');
select is_empty($$ select 1 from public.servizi_trasporto where nome = 'Taxi spento' $$,
                '14 anni: una voce spenta non si vede');

select tests.autentica_come('minore_15');
select is((select count(*)::int from public.servizi_trasporto where tipo <> 'app_trasporto'), 4,
          '15 anni: vede mezzi pubblici e taxi');
select is_empty($$ select 1 from public.servizi_trasporto where tipo = 'app_trasporto' $$,
                '15 anni: nessuna app di trasporto');

select tests.autentica_come('minore_16');
select is((select count(*)::int from public.servizi_trasporto where tipo <> 'app_trasporto'), 4,
          '16 anni: vede mezzi pubblici e taxi');
select results_eq($$ select nome from public.servizi_trasporto where tipo = 'app_trasporto' $$,
                  $$ values ('App dai sedici'::text) $$,
                  '16 anni: solo l''app che ammette i sedicenni');
select is_empty($$ select 1 from public.servizi_trasporto where nome = 'Uber' $$,
                '16 anni: Uber non si vede');

select tests.autentica_come('minore_17');
select results_eq($$ select nome from public.servizi_trasporto where tipo = 'app_trasporto' $$,
                  $$ values ('App dai sedici'::text) $$,
                  '17 anni: solo l''app che ammette i sedicenni');
select is_empty($$ select 1 from public.servizi_trasporto where nome = 'Uber' $$,
                '17 anni: Uber non si vede');

select tests.autentica_come('adulto_18');
select is((select count(*)::int from public.servizi_trasporto where tipo = 'app_trasporto'), 2,
          '18 anni: vede tutte le app di trasporto');
select isnt_empty($$ select 1 from public.servizi_trasporto where nome = 'Uber' $$,
                  '18 anni: Uber si vede');
select is_empty($$ select 1 from public.servizi_trasporto where nome = 'Taxi spento' $$,
                '18 anni: una voce spenta non si vede');

select tests.autentica_come('adulto_20');
select is((select count(*)::int from public.servizi_trasporto), 6,
          '20 anni: tutte le voci attive');

select tests.autentica_come('adulto_21');
select is((select count(*)::int from public.servizi_trasporto), 6,
          '21 anni: tutte le voci attive');
select results_eq(
  $$ select nome from public.servizi_trasporto where ordine < 900 order by ordine $$,
  $$ values ('Rete notturna ATM'::text), ('Radiotaxi 02 4040'), ('Radiotaxi 02 8585'),
            ('Radiotaxi Monza'), ('Uber') $$,
  'Ordine fisso: mezzi pubblici, taxi, app');

select tests.autentica_come('moderatore');
select is((select count(*)::int from public.servizi_trasporto), 6,
          'Moderatore: le stesse voci di un adulto, senza quelle spente');

-- ---------------------------------------------------------------------------------------------
-- Scrittura: nessuno dall'app, nemmeno i moderatori
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select throws_ok(
  $$ insert into public.servizi_trasporto (tipo, nome, zona, telefono, fonte_url, verificato_il)
     values ('taxi', 'Taxi finto', 'milano', '+39021111', 'https://example.org', current_date) $$,
  '42501', null, 'Un utente non aggiunge voci');
select throws_ok($$ update public.servizi_trasporto set eta_minima = 14 where nome = 'Uber' $$,
                 '42501', null, 'Un minorenne non abbassa l''età di una voce');
select throws_ok($$ delete from public.servizi_trasporto $$,
                 '42501', null, 'Un utente non cancella voci');

select tests.autentica_come('adulto_21');
select throws_ok($$ update public.servizi_trasporto set telefono = '+39029999' $$,
                 '42501', null, 'Un adulto non modifica le voci');

select tests.autentica_come('moderatore');
select throws_ok(
  $$ insert into public.servizi_trasporto (tipo, nome, zona, telefono, fonte_url, verificato_il)
     values ('taxi', 'Taxi finto', 'milano', '+39021111', 'https://example.org', current_date) $$,
  '42501', null, 'Un moderatore non aggiunge voci dall''app: servono una migrazione e una verifica');
select throws_ok($$ delete from public.servizi_trasporto $$,
                 '42501', null, 'Un moderatore non cancella voci dall''app');

select tests.autentica_come('moderatore_senza_mfa');
select throws_ok($$ update public.servizi_trasporto set attivo = false $$,
                 '42501', null, 'Un moderatore senza due fattori non modifica le voci');

-- R-07: nessun accesso anonimo.
select tests.esci();
set local role anon;
select throws_ok($$ select 1 from public.servizi_trasporto $$,
                 '42501', null, 'R-07: anon non legge il catalogo');
reset role;

-- ---------------------------------------------------------------------------------------------
-- Vincoli
-- ---------------------------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.servizi_trasporto (tipo, nome, zona, url, fonte_url, verificato_il)
     values ('app_trasporto', 'App http', 'tutte', 'http://example.org', 'https://example.org',
             current_date) $$,
  '23514', null, 'Un link non https è rifiutato');
select throws_ok(
  $$ insert into public.servizi_trasporto (tipo, nome, zona, telefono, fonte_url, verificato_il)
     values ('taxi', 'Taxi estero', 'milano', '+4412345678', 'https://example.org',
             current_date) $$,
  '23514', null, 'Un numero non italiano è rifiutato');
select throws_ok(
  $$ insert into public.servizi_trasporto (tipo, nome, zona, url, fonte_url, verificato_il)
     values ('taxi', 'Taxi senza numero', 'milano', 'https://example.org', 'https://example.org',
             current_date) $$,
  '23514', null, 'Un taxi senza numero è rifiutato');
select throws_ok(
  $$ insert into public.servizi_trasporto
       (tipo, nome, zona, url, eta_minima, fonte_url, verificato_il)
     values ('app_trasporto', 'App per bambini', 'tutte', 'https://example.org', 12,
             'https://example.org', current_date) $$,
  '23514', null, 'Un''età minima sotto i 14 anni è rifiutata');
select throws_ok(
  $$ insert into public.servizi_trasporto (tipo, nome, zona, telefono, fonte_url, verificato_il)
     values ('taxi', 'Taxi di Roma', 'roma', '+39060000', 'https://example.org', current_date) $$,
  '23514', null, 'Una zona fuori da Milano e Brianza è rifiutata');
select throws_ok(
  $$ insert into public.servizi_trasporto (tipo, nome, zona, telefono, fonte_url, verificato_il)
     values ('taxi', 'Radiotaxi Monza', 'brianza', '+39039000000', 'https://example.org',
             current_date) $$,
  '23505', null, 'Lo stesso servizio non si ripete nella stessa zona');
select throws_ok(
  $$ insert into public.servizi_trasporto (tipo, nome, zona, telefono, fonte_url, verificato_il)
     values ('taxi', 'Taxi senza fonte', 'milano', '+39021111', 'ftp://example.org',
             current_date) $$,
  '23514', null, 'La fonte deve essere un link https');
select lives_ok(
  $$ update public.servizi_trasporto set verificato_il = current_date where nome = 'Uber' $$,
  'Chi amministra il database aggiorna la data di verifica');

select * from finish();
rollback;
