-- dispositivi_push (DATA_MODEL.md §5.1), RPC registra_dispositivo_push, webhook invia_push verso
-- l'Edge Function invia-push, conservazione ed esportazione. Regole: R-64, R-65, R-66.
begin;
select plan(35);

-- Iscrizione Web Push di prova: endpoint di un servizio push e chiavi nel formato del browser.
create function tests.endpoint(n text) returns text language sql immutable as $$
  select 'https://fcm.googleapis.com/fcm/send/prova-' || n;
$$;
create function tests.registra(n text) returns uuid language sql as $$
  select public.registra_dispositivo_push(
    'web', tests.endpoint(n), repeat('B', 87), repeat('a', 22), 'Android · Chrome');
$$;
grant execute on function tests.endpoint(text) to authenticated;
grant execute on function tests.registra(text) to authenticated;

select ok((select relrowsecurity from pg_class where oid = 'public.dispositivi_push'::regclass),
          'RLS su dispositivi_push');
select ok(not exists (select 1 from public.profili_privati where notifiche_push_abilitate),
          'Le notifiche sul telefono sono spente per tutti gli utenti del seed');

-- ---------------------------------------------------------------------------------------------
-- Ogni età registra il proprio dispositivo e vede solo i propri
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select lives_ok($$ select tests.registra('14') $$, '14 anni registra un dispositivo');
select tests.autentica_come('minore_15');
select lives_ok($$ select tests.registra('15') $$, '15 anni registra un dispositivo');
select tests.autentica_come('minore_16');
select lives_ok($$ select tests.registra('16') $$, '16 anni registra un dispositivo');
select tests.autentica_come('minore_17');
select lives_ok($$ select tests.registra('17') $$, '17 anni registra un dispositivo');
select tests.autentica_come('adulto_18');
select lives_ok($$ select tests.registra('18') $$, '18 anni registra un dispositivo');
select tests.autentica_come('adulto_20');
select lives_ok($$ select tests.registra('20') $$, '20 anni registra un dispositivo');
select tests.autentica_come('adulto_21');
select lives_ok($$ select tests.registra('21') $$, '21 anni registra un dispositivo');
select tests.autentica_come('moderatore');
select lives_ok($$ select tests.registra('mod') $$, 'Il moderatore registra un dispositivo');
select is((select count(*)::int from public.dispositivi_push), 1,
          'Il moderatore vede solo il proprio dispositivo (R-69)');

select tests.autentica_come('minore_14');
select is((select count(*)::int from public.dispositivi_push), 1, '14 anni vede solo il proprio dispositivo');
select ok((select notifiche_push_abilitate from public.profili_privati), 'Con un dispositivo le notifiche risultano attive');
select lives_ok($$ select tests.registra('14') $$, 'Registrare di nuovo lo stesso dispositivo lo rinnova');
select is((select count(*)::int from public.dispositivi_push), 1, 'Il rinnovo non crea una seconda riga');
select tests.autentica_come('adulto_21');
select is((select count(*)::int from public.dispositivi_push where token = tests.endpoint('14')), 0,
          'Un adulto non vede il dispositivo di un minorenne');
delete from public.dispositivi_push where token = tests.endpoint('14');
select tests.esci();
select is((select count(*)::int from public.dispositivi_push where token = tests.endpoint('14')), 1,
          'Nessuno toglie il dispositivo di altri');

-- ---------------------------------------------------------------------------------------------
-- Scrittura solo dalla RPC, endpoint solo dei servizi push
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_15');
select throws_ok(
  $$ insert into public.dispositivi_push (utente_id, piattaforma, token, chiave_p256dh, chiave_auth)
     values (tests.id('minore_15'), 'web', tests.endpoint('x'), repeat('B', 87), repeat('a', 22)) $$,
  '42501', null, 'I dispositivi non si inseriscono direttamente');
select throws_ok(
  $$ select public.registra_dispositivo_push('web', 'https://indirizzo.example/push', repeat('B', 87),
                                             repeat('a', 22), null) $$,
  '23514', null, 'Solo endpoint dei servizi push dei browser');
select throws_ok(
  $$ select public.registra_dispositivo_push('web', tests.endpoint('senza-chiavi'), null, null, null) $$,
  '23514', null, 'Un dispositivo web ha le chiavi della cifratura');
select throws_ok(
  $$ update public.profili_privati set notifiche_push_abilitate = true $$,
  '42501', null, 'L''impostazione la scrive solo il database');
select tests.esci();
set local role anon;
select throws_ok($$ select public.registra_dispositivo_push('web', 'https://fcm.googleapis.com/fcm/send/anon',
                                                            repeat('B', 87), repeat('a', 22), null) $$,
                 '42501', null, 'Il ruolo anon non registra dispositivi');
reset role;

-- Lo stesso browser passa a un altro account: la riga cambia proprietario.
select tests.autentica_come('minore_15');
select lives_ok($$ select tests.registra('14') $$, 'Il browser di 14 anni ora è di 15 anni');
select tests.esci();
select is((select utente_id from public.dispositivi_push where token = tests.endpoint('14')), tests.id('minore_15'),
          'Un endpoint appartiene a un solo account');
select ok(not (select notifiche_push_abilitate from public.profili_privati where utente_id = tests.id('minore_14')),
          'Senza dispositivi le notifiche risultano spente');

select tests.autentica_come('minore_16');
select lives_ok($$ delete from public.dispositivi_push $$, 'Il titolare toglie il proprio dispositivo');
select ok(not (select notifiche_push_abilitate from public.profili_privati), 'Tolto l''ultimo, le notifiche si spengono');

select tests.autentica_come('adulto_20');
select tests.registra('20-' || n) from generate_series(1, 11) n;
select is((select count(*)::int from public.dispositivi_push), 10, 'Al massimo 10 dispositivi per persona');

-- ---------------------------------------------------------------------------------------------
-- Webhook verso invia-push (ADR-0026)
-- ---------------------------------------------------------------------------------------------
select tests.esci();
create temporary table richieste_prima as select count(*) as n from net.http_request_queue;
select private.crea_notifica(tests.id('minore_15'), 'badge_ottenuto', '{}');
select is((select count(*) from net.http_request_queue), (select n from richieste_prima),
          'Senza configurazione nel Vault nessuna richiesta parte');

select vault.create_secret('https://progetto.supabase.co/functions/v1/invia-push', 'invia_push_url');
select vault.create_secret('segreto-di-prova', 'invia_push_segreto');
select private.crea_notifica(tests.id('minore_16'), 'badge_ottenuto', '{}');
select is((select count(*) from net.http_request_queue), (select n from richieste_prima),
          'Chi non ha dispositivi non genera richieste');
select private.crea_notifica(tests.id('minore_15'), 'richiesta_amicizia',
                             jsonb_build_object('utente_id', tests.id('minore_14')));
select is((select count(*) from net.http_request_queue), (select n from richieste_prima) + 1,
          'Una notifica per chi ha un dispositivo chiama invia-push');
select is((select convert_from(body, 'UTF8')::jsonb from net.http_request_queue order by id desc limit 1),
          jsonb_build_object('notifica_id', (select id from public.notifiche
                                             where utente_id = tests.id('minore_15') and tipo = 'richiesta_amicizia'
                                             order by creata_il desc limit 1)),
          'La richiesta contiene solo l''identificativo della notifica, nessun dato di altri');

-- ---------------------------------------------------------------------------------------------
-- Conservazione ed esportazione
-- ---------------------------------------------------------------------------------------------
update public.dispositivi_push set ultimo_uso_il = now() - interval '91 days' where token = tests.endpoint('17');
select private.applica_conservazione();
select is((select count(*)::int from public.dispositivi_push where token = tests.endpoint('17')), 0,
          'R-65: dispositivo tolto dopo 90 giorni senza uso');

select tests.autentica_come('minore_15');
select is(jsonb_array_length(public.esporta_miei_dati() -> 'dispositivi_push'), 2,
          'R-64: l''esportazione contiene i dispositivi');
select tests.esci();
delete from private.esportazioni_dati;
select tests.autentica_come('minore_15');
select ok(not (public.esporta_miei_dati()::text like '%fcm.googleapis.com%'),
          'L''esportazione non contiene endpoint né chiavi');

select * from finish();
rollback;
