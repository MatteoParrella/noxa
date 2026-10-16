-- profili, profili_privati, ruoli_utente e funzioni di età e fascia (DATA_MODEL.md §4, §5.1).
-- Regole: R-02, R-04, R-05, R-06, R-07, R-10, R-13.
begin;
select plan(61);

-- ---------------------------------------------------------------------------------------------
-- Età e fascia calcolate nel database (R-04)
-- ---------------------------------------------------------------------------------------------
select is(private.eta_di(tests.id('minore_14')), 14, 'R-04: eta_di vale 14 per minore_14');
select is(private.eta_di(tests.id('minore_15')), 15, 'R-04: eta_di vale 15 per minore_15');
select is(private.eta_di(tests.id('minore_16')), 16, 'R-04: eta_di vale 16 per minore_16');
select is(private.eta_di(tests.id('minore_17')), 17, 'R-04: eta_di vale 17 per minore_17');
select is(private.eta_di(tests.id('adulto_18')), 18, 'R-04: eta_di vale 18 per adulto_18');
select is(private.eta_di(tests.id('adulto_20')), 20, 'R-04: eta_di vale 20 per adulto_20');
select is(private.eta_di(tests.id('adulto_21')), 21, 'R-04: eta_di vale 21 per adulto_21');
select ok(private.e_minorenne(tests.id('minore_14')), 'minore_14 è minorenne');
select ok(private.e_minorenne(tests.id('minore_17')), 'minore_17 è minorenne');
select ok(not private.e_minorenne(tests.id('adulto_18')), 'adulto_18 non è minorenne');
select ok(private.e_minorenne(gen_random_uuid()), 'Un utente senza età nota è trattato come minorenne');
select ok(private.stessa_fascia(tests.id('minore_14'), tests.id('minore_17')),
          'ADR-0017: 14 e 17 anni sono nella stessa fascia');
select ok(not private.stessa_fascia(tests.id('minore_17'), tests.id('adulto_18')),
          '17 e 18 anni sono in fasce diverse');
select ok(private.stessa_fascia(tests.id('adulto_18'), tests.id('adulto_21')),
          '18 e 21 anni sono nella stessa fascia');

-- Il compleanno conta nel fuso Europe/Rome: chi compie 18 anni oggi è maggiorenne.
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a1',
        'authenticated', 'authenticated', 'compleanno@example.com',
        jsonb_build_object(
          'username', 'compleanno', 'nome_visualizzato', 'Compleanno',
          'data_nascita', ((now() at time zone 'Europe/Rome')::date - interval '18 years')::date,
          'consensi', jsonb_build_object('termini', '2026-10', 'privacy', '2026-10')));
select is(private.eta_di('00000000-0000-4000-8000-0000000000a1'), 18,
          'R-04: chi compie 18 anni oggi ha 18 anni');
select ok(not private.e_minorenne('00000000-0000-4000-8000-0000000000a1'),
          'R-04: chi compie 18 anni oggi non è più minorenne');

-- ---------------------------------------------------------------------------------------------
-- profili: ognuno vede solo il proprio profilo (R-10, R-13), per tutte le età del seed
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select results_eq($$ select username::text from public.profili $$, array['minore_14'],
                  'R-10: minore_14 vede solo il proprio profilo');
select tests.autentica_come('minore_15');
select results_eq($$ select username::text from public.profili $$, array['minore_15'],
                  'R-10: minore_15 vede solo il proprio profilo');
select tests.autentica_come('minore_16');
select results_eq($$ select username::text from public.profili $$, array['minore_16'],
                  'R-10: minore_16 vede solo il proprio profilo');
select tests.autentica_come('minore_17');
select results_eq($$ select username::text from public.profili $$, array['minore_17'],
                  'R-10: minore_17 vede solo il proprio profilo');
select tests.autentica_come('adulto_18');
select results_eq($$ select username::text from public.profili $$, array['adulto_18'],
                  'R-13: adulto_18 non vede profili di minorenni né di sconosciuti');
select tests.autentica_come('adulto_20');
select results_eq($$ select username::text from public.profili $$, array['adulto_20'],
                  'R-13: adulto_20 vede solo il proprio profilo');
select tests.autentica_come('adulto_21');
select results_eq($$ select username::text from public.profili $$, array['adulto_21'],
                  'R-13: adulto_21 vede solo il proprio profilo');
select tests.autentica_come('moderatore');
select results_eq($$ select username::text from public.profili $$, array['moderatore'],
                  'R-69: anche il moderatore non elenca i profili');
select tests.autentica_come('moderatore_senza_mfa');
select results_eq($$ select username::text from public.profili $$, array['moderatore_senza_mfa'],
                  'moderatore_senza_mfa vede solo il proprio profilo');

-- Modifiche
select tests.autentica_come('minore_16');
select lives_ok(
  $$ update public.profili set nome_visualizzato = 'Nuovo nome' where id = tests.id('minore_16') $$,
  'Il titolare cambia il proprio nome visualizzato'
);
select is_empty(
  $$ update public.profili set nome_visualizzato = 'Intruso' where id = tests.id('minore_17') returning 1 $$,
  'Un utente non modifica il profilo di un altro'
);
select throws_ok(
  $$ update public.profili set stato_account = 'attivo' where id = tests.id('minore_16') $$,
  '42501', null,
  'Il titolare non cambia lo stato del proprio account'
);
select throws_ok(
  $$ update public.profili set username = 'Maiuscolo' where id = tests.id('minore_16') $$,
  '23514', null,
  'Lo username rispetta il formato'
);
select throws_ok(
  $$ update public.profili set username = 'minore_17' where id = tests.id('minore_16') $$,
  '23505', null,
  'Lo username è unico'
);
select throws_ok(
  $$ update public.profili set nome_visualizzato = repeat('a', 41) where id = tests.id('minore_16') $$,
  '23514', null,
  'Il nome visualizzato ha al massimo 40 caratteri'
);
select throws_ok(
  $$ insert into public.profili (id, username, nome_visualizzato)
     values (gen_random_uuid(), 'nuovo', 'Nuovo') $$,
  '42501', null,
  'Nessun utente crea profili: li crea solo il trigger di registrazione'
);
select throws_ok(
  $$ delete from public.profili where id = tests.id('minore_16') $$,
  '42501', null,
  'Il profilo non si elimina dall''API (solo con elimina-account)'
);

-- ---------------------------------------------------------------------------------------------
-- profili_privati: solo il titolare (R-05); data di nascita immutabile (R-02)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select results_eq($$ select utente_id from public.profili_privati $$,
                  array[tests.id('minore_14')], 'R-05: minore_14 vede solo i propri dati privati');
select tests.autentica_come('minore_17');
select results_eq($$ select utente_id from public.profili_privati $$,
                  array[tests.id('minore_17')], 'R-05: minore_17 vede solo i propri dati privati');
select tests.autentica_come('adulto_18');
select results_eq($$ select utente_id from public.profili_privati $$,
                  array[tests.id('adulto_18')], 'R-05: adulto_18 non vede la data di nascita di altri');
select tests.autentica_come('adulto_21');
select results_eq($$ select utente_id from public.profili_privati $$,
                  array[tests.id('adulto_21')], 'R-05: adulto_21 non vede la data di nascita di altri');
select tests.autentica_come('moderatore');
select results_eq($$ select utente_id from public.profili_privati $$,
                  array[tests.id('moderatore')], 'R-69: il moderatore non vede i dati privati degli utenti');

select tests.autentica_come('minore_15');
select throws_ok(
  $$ update public.profili_privati set data_nascita = '2000-01-01' where utente_id = tests.id('minore_15') $$,
  '42501', null,
  'R-02: un minorenne non cambia la propria data di nascita'
);
select tests.autentica_come('adulto_20');
select throws_ok(
  $$ update public.profili_privati set data_nascita = '2012-01-01' where utente_id = tests.id('adulto_20') $$,
  '42501', null,
  'R-02: un adulto non si dichiara minorenne cambiando la data di nascita'
);
select lives_ok(
  $$ update public.profili_privati set onboarding_completato_il = now(), partecipazioni_visibili = false
     where utente_id = tests.id('adulto_20') $$,
  'Il titolare cambia le proprie impostazioni'
);
select is_empty(
  $$ update public.profili_privati set checkin_abilitato = true
     where utente_id = tests.id('minore_14') returning 1 $$,
  'Un utente non cambia le impostazioni di un altro'
);
select throws_ok(
  $$ delete from public.profili_privati where utente_id = tests.id('adulto_20') $$,
  '42501', null,
  'I dati privati non si eliminano dall''API'
);

select tests.esci();
select throws_ok(
  $$ update public.profili_privati set data_nascita = '2000-01-01' where utente_id = tests.id('minore_15') $$,
  'NX007', null,
  'R-02: il trigger rifiuta la modifica della data di nascita anche fuori dall''API'
);
select lives_ok(
  $$ select set_config('noxa.correzione_data_nascita', 'consentita', true);
     update public.profili_privati set data_nascita = data_nascita - 1 where utente_id = tests.id('minore_15') $$,
  'R-02: la correzione è possibile solo con l''impostazione della RPC degli amministratori'
);
select set_config('noxa.correzione_data_nascita', '', true);

-- Impostazioni protettive di default (R-30, R-67)
select results_eq(
  $$ select checkin_abilitato, notifiche_push_abilitate from public.profili_privati
     where utente_id = '00000000-0000-4000-8000-0000000000a1' $$,
  $$ values (false, false) $$,
  'R-30: check-in e notifiche push spenti alla registrazione'
);

-- ---------------------------------------------------------------------------------------------
-- ruoli_utente e moderatori con MFA (R-06)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('moderatore');
select results_eq($$ select ruolo::text from public.ruoli_utente $$, array['moderatore'],
                  'Il moderatore vede il proprio ruolo');
select ok(private.e_moderatore(), 'R-06: moderatore con aal2 è moderatore');
select ok(not private.e_amministratore(), 'Il moderatore non è amministratore');
select tests.autentica_come('moderatore_senza_mfa');
select ok(not private.e_moderatore(), 'R-06: senza autenticazione a due fattori non si è moderatori');
select tests.autentica_come('adulto_21');
select is_empty($$ select 1 from public.ruoli_utente $$, 'Un utente senza ruoli non vede ruoli');
select ok(not private.e_moderatore(), 'Un utente qualsiasi non è moderatore');
select throws_ok(
  $$ insert into public.ruoli_utente (utente_id, ruolo) values (tests.id('adulto_21'), 'moderatore') $$,
  '42501', null,
  'Un utente non si assegna un ruolo'
);
select tests.autentica_come('moderatore');
select throws_ok(
  $$ insert into public.ruoli_utente (utente_id, ruolo) values (tests.id('moderatore'), 'amministratore') $$,
  '42501', null,
  'Un moderatore non si promuove ad amministratore'
);
select throws_ok(
  $$ delete from public.ruoli_utente where utente_id = tests.id('moderatore') $$,
  '42501', null,
  'I ruoli non si eliminano dall''API'
);

-- ---------------------------------------------------------------------------------------------
-- Nessun accesso anonimo (R-07)
-- ---------------------------------------------------------------------------------------------
select tests.esci();
set local role anon;
select throws_ok($$ select 1 from public.profili $$, '42501', null, 'R-07: anon non legge profili');
select throws_ok($$ select 1 from public.profili_privati $$, '42501', null,
                 'R-07: anon non legge profili_privati');
select throws_ok($$ select 1 from public.ruoli_utente $$, '42501', null,
                 'R-07: anon non legge ruoli_utente');
select throws_ok($$ select private.eta_di(gen_random_uuid()) $$, '42501', null,
                 'R-07: anon non usa le funzioni di private');
reset role;

-- Le funzioni di private non sono eseguibili da chi non ne ha bisogno
select ok(not has_function_privilege('anon', 'private.e_minorenne(uuid)', 'execute'),
          'anon non esegue private.e_minorenne');
select ok(has_function_privilege('authenticated', 'private.puo_vedere_profilo(uuid)', 'execute'),
          'authenticated esegue private.puo_vedere_profilo nelle policy');

select * from finish();
rollback;
