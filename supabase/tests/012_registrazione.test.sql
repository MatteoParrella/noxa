-- Registrazione (hook e trigger), consensi versionati e RPC mio_account.
-- Regole: R-01, R-05, R-60, R-63. DATA_MODEL.md §5.1, §5.10; ARCHITECTURE.md §4.1.
begin;
select plan(43);

-- Dati di registrazione validi di riferimento: ogni caso ne cambia uno.
create temporary table dati_validi as
select jsonb_build_object(
  'username', 'prova.registraz',
  'nome_visualizzato', 'Giulia',
  'data_nascita', ((now() at time zone 'Europe/Rome')::date - interval '16 years')::date,
  'consensi', jsonb_build_object('termini', '2026-10', 'privacy', '2026-10')
) as dati;

-- ---------------------------------------------------------------------------------------------
-- Verifica dei dati (R-01, R-60, R-63)
-- ---------------------------------------------------------------------------------------------
select is(private.verifica_dati_registrazione((select dati from dati_validi)), null,
          'Dati validi accettati');
select is(
  private.verifica_dati_registrazione((select dati || jsonb_build_object('data_nascita',
    ((now() at time zone 'Europe/Rome')::date - interval '14 years' + interval '1 day')::date)
    from dati_validi)),
  'NX001', 'R-01 profili_eta_minima: a un giorno dai 14 anni la registrazione è rifiutata');
select is(
  private.verifica_dati_registrazione((select dati || jsonb_build_object('data_nascita',
    ((now() at time zone 'Europe/Rome')::date - interval '14 years')::date) from dati_validi)),
  null, 'R-01 profili_eta_minima: chi compie 14 anni oggi si registra');
select is(
  private.verifica_dati_registrazione((select dati || jsonb_build_object('data_nascita',
    ((now() at time zone 'Europe/Rome')::date - interval '13 years')::date) from dati_validi)),
  'NX001', 'R-01 profili_eta_minima: a 13 anni la registrazione è rifiutata');
select is(private.verifica_dati_registrazione((select dati - 'data_nascita' from dati_validi)),
          'NX005', 'La data di nascita è obbligatoria');
select is(private.verifica_dati_registrazione(
            (select dati || '{"data_nascita": "2009-02-31"}' from dati_validi)),
          'NX005', 'Una data inesistente è rifiutata');
select is(private.verifica_dati_registrazione(
            (select dati || '{"data_nascita": "14/03/2009"}' from dati_validi)),
          'NX005', 'Una data in un formato diverso è rifiutata');
select is(private.verifica_dati_registrazione(
            (select dati || jsonb_build_object('data_nascita', current_date + 1) from dati_validi)),
          'NX005', 'Una data futura è rifiutata');
select is(private.verifica_dati_registrazione(
            (select dati || '{"username": "Giulia"}' from dati_validi)),
          'NX002', 'Lo username in maiuscolo è rifiutato');
select is(private.verifica_dati_registrazione(
            (select dati || '{"username": "gi"}' from dati_validi)),
          'NX002', 'Lo username di 2 caratteri è rifiutato');
select is(private.verifica_dati_registrazione(
            (select dati || '{"username": "minore_14"}' from dati_validi)),
          'NX003', 'Lo username già in uso è rifiutato');
select is(private.verifica_dati_registrazione(
            (select dati || '{"nome_visualizzato": ""}' from dati_validi)),
          'NX004', 'Il nome visualizzato vuoto è rifiutato');
select is(private.verifica_dati_registrazione(
            (select dati || jsonb_build_object('nome_visualizzato', repeat('a', 41)) from dati_validi)),
          'NX004', 'Il nome visualizzato di 41 caratteri è rifiutato');
select is(private.verifica_dati_registrazione((select dati - 'consensi' from dati_validi)),
          'NX006', 'R-63: senza consensi la registrazione è rifiutata');
select is(private.verifica_dati_registrazione(
            (select dati || '{"consensi": {"termini": "2025-01", "privacy": "2026-10"}}' from dati_validi)),
          'NX006', 'R-63: il consenso a una versione non in vigore è rifiutato');

-- ---------------------------------------------------------------------------------------------
-- Hook di Supabase Auth
-- ---------------------------------------------------------------------------------------------
select is(
  private.prima_della_creazione_utente(jsonb_build_object('user', jsonb_build_object(
    'user_metadata', (select dati || jsonb_build_object('data_nascita',
      ((now() at time zone 'Europe/Rome')::date - interval '13 years')::date) from dati_validi)))),
  '{"error": {"http_code": 400, "message": "NX001"}}'::jsonb,
  'R-01: l''hook rifiuta un tredicenne con il codice NX001'
);
select is(
  private.prima_della_creazione_utente(jsonb_build_object('user',
    jsonb_build_object('user_metadata', (select dati from dati_validi)))),
  '{}'::jsonb,
  'L''hook accetta dati validi'
);
select ok(has_function_privilege('supabase_auth_admin',
            'private.prima_della_creazione_utente(jsonb)', 'execute'),
          'Supabase Auth esegue l''hook');
select ok(not has_function_privilege('authenticated',
            'private.prima_della_creazione_utente(jsonb)', 'execute'),
          'Gli utenti non eseguono l''hook');
select ok(not has_function_privilege('anon', 'private.verifica_dati_registrazione(jsonb)', 'execute'),
          'anon non interroga la verifica dei dati (nessuna ricerca di username dall''esterno)');

-- ---------------------------------------------------------------------------------------------
-- Trigger su auth.users: vale anche senza hook (R-01)
-- ---------------------------------------------------------------------------------------------
select throws_ok(
  $$ insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
             'authenticated', 'tredici@example.com',
             (select dati || jsonb_build_object('data_nascita',
               ((now() at time zone 'Europe/Rome')::date - interval '13 years')::date)
              from dati_validi)) $$,
  'NX001', null,
  'R-01 profili_eta_minima: il database rifiuta un tredicenne anche senza hook'
);
select is_empty($$ select 1 from auth.users where email = 'tredici@example.com' $$,
                'R-01: nessun utente creato per il tredicenne');
select throws_ok(
  $$ insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
             'authenticated', 'senzadati@example.com', '{}') $$,
  'NX005', null,
  'Un utente senza dati di registrazione è rifiutato'
);

select lives_ok(
  $$ insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
     values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000b1',
             'authenticated', 'authenticated', 'prova.registraz@example.com',
             (select dati from dati_validi)) $$,
  'Una registrazione valida crea l''utente'
);
select results_eq(
  $$ select username::text, nome_visualizzato, stato_account::text from public.profili
     where id = '00000000-0000-4000-8000-0000000000b1' $$,
  $$ values ('prova.registraz', 'Giulia', 'attivo') $$,
  'Il trigger crea il profilo'
);
select is(
  (select data_nascita from public.profili_privati where utente_id = '00000000-0000-4000-8000-0000000000b1'),
  ((now() at time zone 'Europe/Rome')::date - interval '16 years')::date,
  'Il trigger salva la data di nascita in profili_privati'
);
select results_eq(
  $$ select tipo::text, versione from public.consensi
     where utente_id = '00000000-0000-4000-8000-0000000000b1' order by tipo::text $$,
  $$ values ('privacy', '2026-10'), ('termini', '2026-10') $$,
  'R-63: il trigger registra i consensi con la versione accettata'
);
select is(
  (select raw_user_meta_data ?| array['data_nascita', 'username', 'nome_visualizzato', 'consensi']
   from auth.users where id = '00000000-0000-4000-8000-0000000000b1'),
  false,
  'R-05: i dati di registrazione non restano nei metadati (né nel JWT)'
);
update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"data_nascita": "2009-03-14"}'
where id = '00000000-0000-4000-8000-0000000000b1';
select is(
  (select raw_user_meta_data ? 'data_nascita' from auth.users
   where id = '00000000-0000-4000-8000-0000000000b1'),
  false,
  'R-05: la data di nascita non torna nei metadati con un aggiornamento'
);

-- ---------------------------------------------------------------------------------------------
-- consensi (R-63)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select is((select count(*) from public.consensi), 2::bigint,
          'Il titolare vede solo i propri due consensi');
select throws_ok(
  $$ insert into public.consensi (utente_id, tipo, versione)
     values (tests.id('minore_16'), 'termini', '2025-01') $$,
  '42501', null,
  'R-63: non si registra il consenso a una versione non in vigore'
);
select throws_ok(
  $$ insert into public.consensi (utente_id, tipo, versione)
     values (tests.id('minore_17'), 'termini', '2026-10') $$,
  '42501', null,
  'Non si registra il consenso di un altro utente'
);
select throws_ok(
  $$ insert into public.consensi (utente_id, tipo, versione, accettato_il)
     values (tests.id('minore_16'), 'termini', '2026-10', '2020-01-01') $$,
  '42501', null,
  'La data del consenso la decide il database'
);
select throws_ok(
  $$ update public.consensi set versione = '2030-01' $$,
  '42501', null,
  'R-63: i consensi non si modificano'
);
select throws_ok(
  $$ delete from public.consensi $$,
  '42501', null,
  'R-63: i consensi non si cancellano'
);

-- Nuova versione dei termini: chi non l'ha accettata la vede in mio_account
select tests.esci();
insert into private.versioni_documenti (tipo, versione, in_vigore_dal, novita)
values ('termini', '2026-11', (now() at time zone 'Europe/Rome')::date,
        array['Spieghiamo meglio come usiamo la posizione']);

select tests.autentica_come('adulto_18');
select is(
  public.mio_account() -> 'documenti_da_accettare' -> 0 ->> 'versione', '2026-11',
  'R-63: la nuova versione dei termini va accettata di nuovo'
);
select lives_ok(
  $$ insert into public.consensi (utente_id, tipo, versione)
     values (tests.id('adulto_18'), 'termini', '2026-11') $$,
  'R-63: il titolare accetta la nuova versione'
);
select is(public.mio_account() -> 'documenti_da_accettare', '[]'::jsonb,
          'Dopo l''accettazione non restano documenti da accettare');

-- ---------------------------------------------------------------------------------------------
-- mio_account: solo dati del chiamante
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select is((public.mio_account() ->> 'minorenne')::boolean, true,
          'mio_account: minore_14 risulta minorenne (testi dell''onboarding)');
select is(public.mio_account() ->> 'username', 'minore_14',
          'mio_account restituisce i dati del chiamante');
select ok(not (public.mio_account() ? 'data_nascita'),
          'R-05: mio_account non restituisce la data di nascita');
select tests.autentica_come('adulto_21');
select is((public.mio_account() ->> 'minorenne')::boolean, false,
          'mio_account: adulto_21 risulta maggiorenne');

select tests.esci();
set local role anon;
select throws_ok($$ select public.mio_account() $$, '42501', null,
                 'R-07: anon non chiama mio_account');
reset role;

select * from finish();
rollback;
