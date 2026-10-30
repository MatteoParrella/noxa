-- Diritti privacy (DATA_MODEL.md §5.9, §5.10, §8): esportazione dei propri dati, eliminazione
-- dell'account con password e due fattori, identità conservata per R-55, conservazione e nuova
-- versione dell'informativa.
-- Regole: R-55, R-63, R-64, R-65, R-69.
begin;
select plan(50);

-- ---------------------------------------------------------------------------------------------
-- Esportazione: ogni età riceve solo i propri dati, una volta all'ora
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_15');
select public.salva_serata_diario(jsonb_build_object(
  'id', '00000000-0000-4000-8000-0000000e0015', 'data_serata', current_date - 1,
  'nome_locale_libero', 'Festa da Luca', 'amici', jsonb_build_array(tests.id('minore_16'))));
insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo, dettagli)
values (tests.id('minore_15'), 'profilo', tests.id('minore_16'), 'spam', 'Testo della segnalazione');

create temporary table esportazione_15 on commit drop as select public.esporta_miei_dati() as dati;
grant select on esportazione_15 to authenticated;
select is((select dati ->> 'formato' from esportazione_15), 'noxa-esportazione-1', '15 anni: esporta i suoi dati');
select is((select dati -> 'profilo' ->> 'username' from esportazione_15), 'minore_15', 'Con il proprio profilo');
select is((select dati -> 'account' ->> 'email' from esportazione_15), 'minore_15@example.com', 'Con la propria email');
select ok((select (dati -> 'impostazioni' ->> 'data_nascita') is not null from esportazione_15),
          'Con la propria data di nascita (solo per sé, R-05)');
select is((select jsonb_array_length(dati -> 'diario') from esportazione_15), 1, 'Con il diario');
select is((select dati -> 'diario' -> 0 -> 'amici' ->> 0 from esportazione_15), 'minore_16',
          'Gli amici del diario solo come username');
select is((select jsonb_array_length(dati -> 'amicizie') from esportazione_15), 2,
          'Con amicizie e richieste');
select is((select dati -> 'segnalazioni_fatte' -> 0 ->> 'dettagli' from esportazione_15), 'Testo della segnalazione',
          'Con le segnalazioni fatte');
select is((select jsonb_array_length(dati -> 'consensi') from esportazione_15), 2, 'Con i consensi');
select throws_ok($$ select public.esporta_miei_dati() $$, 'NX047', null,
                 'Una seconda esportazione nella stessa ora è rifiutata');

select tests.autentica_come('minore_16');
select is((select jsonb_array_length(public.esporta_miei_dati() -> 'segnalazioni_fatte')), 0,
          'Le segnalazioni ricevute non compaiono nell''esportazione di chi è segnalato');
select tests.esci();
delete from private.esportazioni_dati;

select tests.autentica_come('minore_14');
select is((select public.esporta_miei_dati() -> 'profilo' ->> 'username'), 'minore_14', '14 anni: solo il suo profilo');
select tests.autentica_come('minore_17');
select is((select public.esporta_miei_dati() -> 'profilo' ->> 'username'), 'minore_17', '17 anni: solo il suo profilo');
select tests.autentica_come('adulto_18');
select is((select jsonb_array_length(public.esporta_miei_dati() -> 'diario')), 0,
          '18 anni: il diario di un altro non compare');
select tests.autentica_come('adulto_20');
select is((select public.esporta_miei_dati() -> 'profilo' ->> 'username'), 'adulto_20', '20 anni: solo il suo profilo');
select tests.autentica_come('adulto_21');
select is((select public.esporta_miei_dati() -> 'profilo' ->> 'username'), 'adulto_21', '21 anni: solo il suo profilo');
select tests.autentica_come('moderatore');
select is((select jsonb_array_length(public.esporta_miei_dati() -> 'ruoli')), 1, 'Un moderatore vede il suo ruolo');
select tests.autentica_come('moderatore_senza_mfa');
select is((select jsonb_array_length(public.esporta_miei_dati() -> 'segnalazioni_fatte')), 0,
          'Un moderatore non esporta le segnalazioni degli altri');

select tests.esci();
select throws_ok($$ select public.esporta_miei_dati() $$, '42501', null, 'Senza accesso non si esporta');
set local role anon;
select throws_ok($$ select public.esporta_miei_dati() $$, '42501', null, 'Il ruolo anon non ha la RPC');
select throws_ok($$ select public.elimina_mio_account('x') $$, '42501', null, 'Il ruolo anon non elimina account');
select tests.esci();
select ok(not has_table_privilege('authenticated', 'private.esportazioni_dati', 'select'),
          'Il registro delle esportazioni non è leggibile dagli utenti');
select ok(not has_table_privilege('authenticated', 'private.account_conservati', 'select'),
          'R-69: le identità conservate non sono leggibili da nessun utente, moderatori compresi');

-- ---------------------------------------------------------------------------------------------
-- Eliminazione: password, tentativi e due fattori
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select is(public.elimina_mio_account('sbagliata') ->> 'esito', 'password_errata', 'Password sbagliata: non elimina');
select is((select count(*)::int from public.profili where id = tests.id('minore_16')), 1, 'Il profilo resta');
select tests.esci();
insert into private.tentativi_eliminazione (utente_id)
select tests.id('minore_16') from generate_series(1, 4);
select tests.autentica_come('minore_16');
select throws_ok($$ select public.elimina_mio_account('password-di-prova') $$, 'NX048', null,
                 'Dopo 5 password sbagliate in un''ora l''eliminazione si ferma');
select tests.esci();
delete from private.tentativi_eliminazione;

-- adulto_20 ha i due fattori: con una sessione aal1 serve il codice.
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values (gen_random_uuid(), tests.id('adulto_20'), 'telefono', 'totp', 'verified', now(), now(), 'SEGRETO');
select tests.autentica_come('adulto_20');
select is(public.elimina_mio_account('password-di-prova') ->> 'esito', 'serve_codice',
          'Con i due fattori attivi serve una sessione con il codice');
select set_config('request.jwt.claims',
                  json_build_object('sub', tests.id('adulto_20'), 'role', 'authenticated', 'aal', 'aal2')::text, true);
select is(public.elimina_mio_account('password-di-prova') ->> 'esito', 'eliminato',
          'Con il codice l''account si elimina');
select tests.esci();
select is((select count(*)::int from auth.users where id = tests.id('adulto_20')), 0,
          '20 anni: l''utente non esiste più');

-- minore_15: dati in tutte le tabelle personali, poi l'eliminazione.
select tests.autentica_come('minore_15');
insert into public.partecipazioni_evento (utente_id, evento_id, stato)
values (tests.id('minore_15'), '00000000-0000-4000-8000-00000000e011', 'partecipo')
on conflict do nothing;
select is(public.elimina_mio_account('password-di-prova') ->> 'esito', 'eliminato', '15 anni: elimina l''account');
select tests.esci();
select is((select count(*)::int from public.profili where id = '00000000-0000-4000-8000-000000000015'), 0,
          'Il profilo sparisce');
select is((select count(*)::int from public.profili_privati where utente_id = '00000000-0000-4000-8000-000000000015'), 0,
          'La data di nascita sparisce');
select is((select count(*)::int from public.serate_tracker where utente_id = '00000000-0000-4000-8000-000000000015'), 0,
          'Il diario sparisce');
select is((select count(*)::int from public.tracker_amici where serata_tracker_id = '00000000-0000-4000-8000-0000000e0015'), 0,
          'Gli amici del diario spariscono');
select is((select count(*)::int from public.amicizie
           where '00000000-0000-4000-8000-000000000015' in (richiedente_id, destinatario_id)), 0,
          'Le amicizie spariscono');
select is((select count(*)::int from public.partecipazioni_evento where utente_id = '00000000-0000-4000-8000-000000000015'), 0,
          'Le partecipazioni spariscono');
select is((select count(*)::int from public.consensi where utente_id = '00000000-0000-4000-8000-000000000015'), 0,
          'I consensi spariscono');
select is((select segnalante_id from public.segnalazioni where dettagli = 'Testo della segnalazione'), null,
          'La segnalazione fatta resta senza legame con la persona');
select is((select count(*)::int from private.account_conservati where utente_id = '00000000-0000-4000-8000-000000000015'), 0,
          'Senza escalation nessuna identità conservata');

-- R-55: un account con un'escalation resta identificabile dopo l'eliminazione.
select tests.autentica_come('moderatore');
insert into public.azioni_moderazione (moderatore_id, tipo_oggetto, oggetto_id, azione, motivazione, conservazione_legale)
values (tests.id('moderatore'), 'profilo', tests.id('adulto_21'), 'escalation_autorita', 'Prova di escalation', true);
select tests.autentica_come('adulto_21');
select is(public.elimina_mio_account('password-di-prova') ->> 'esito', 'eliminato',
          'L''account sotto escalation si elimina dall''app');
select tests.esci();
select is((select dati ->> 'email' from private.account_conservati where utente_id = '00000000-0000-4000-8000-000000000021'),
          'adulto_21@example.com', 'R-55: l''identità resta conservata per il procedimento');
select ok((select dati ? 'data_nascita' from private.account_conservati where utente_id = '00000000-0000-4000-8000-000000000021'),
          'R-55: con la data di nascita');

-- ---------------------------------------------------------------------------------------------
-- Conservazione (SAFETY_PRIVACY.md §10)
-- ---------------------------------------------------------------------------------------------
insert into public.segnalazioni (id, segnalante_id, tipo_oggetto, oggetto_id, motivo, stato, chiusa_il, creata_il,
                                 conservazione_legale)
values ('00000000-0000-4000-8000-0000000c5e01', tests.id('minore_17'), 'evento', '00000000-0000-4000-8000-00000000e001',
        'dati_errati', 'chiusa', now() - interval '13 months', now() - interval '13 months', false),
       ('00000000-0000-4000-8000-0000000c5e02', tests.id('minore_17'), 'evento', '00000000-0000-4000-8000-00000000e001',
        'dati_errati', 'chiusa', now() - interval '13 months', now() - interval '13 months', true),
       ('00000000-0000-4000-8000-0000000c5e03', tests.id('minore_17'), 'evento', '00000000-0000-4000-8000-00000000e001',
        'dati_errati', 'chiusa', now() - interval '2 months', now() - interval '2 months', false);
insert into public.azioni_moderazione (id, moderatore_id, tipo_oggetto, oggetto_id, azione, motivazione, creata_il,
                                       conservazione_legale)
values ('00000000-0000-4000-8000-0000000ca001', tests.id('moderatore'), 'evento', '00000000-0000-4000-8000-00000000e001',
        'nessuna_violazione', 'Vecchia', now() - interval '13 months', false),
       ('00000000-0000-4000-8000-0000000ca002', tests.id('moderatore'), 'evento', '00000000-0000-4000-8000-00000000e001',
        'nessuna_violazione', 'Prova', now() - interval '13 months', true),
       ('00000000-0000-4000-8000-0000000ca003', tests.id('moderatore'), 'profilo', tests.id('minore_17'),
        'nessuna_violazione', 'Con reclamo', now() - interval '13 months', false);
insert into public.reclami (azione_id, utente_id, testo, stato, esito, motivazione_esito, deciso_il)
values ('00000000-0000-4000-8000-0000000ca003', tests.id('minore_17'), 'Reclamo', 'deciso', 'confermata',
        'Confermata', now() - interval '3 months');
insert into private.tentativi_eliminazione (utente_id, tentato_il) values (tests.id('minore_17'), now() - interval '2 days');

select private.applica_conservazione();
select is((select count(*)::int from public.segnalazioni where id = '00000000-0000-4000-8000-0000000c5e01'), 0,
          'Una segnalazione chiusa da 13 mesi si elimina');
select is((select count(*)::int from public.segnalazioni where id = '00000000-0000-4000-8000-0000000c5e02'), 1,
          'R-55: una segnalazione conservata come prova resta');
select is((select count(*)::int from public.segnalazioni where id = '00000000-0000-4000-8000-0000000c5e03'), 1,
          'Una segnalazione chiusa da 2 mesi resta');
select is((select count(*)::int from public.azioni_moderazione where id = '00000000-0000-4000-8000-0000000ca001'), 0,
          'Un''azione di moderazione di 13 mesi fa si elimina');
select is((select count(*)::int from public.azioni_moderazione where id = '00000000-0000-4000-8000-0000000ca002'), 1,
          'R-55: un''azione conservata come prova resta');
select is((select count(*)::int from public.azioni_moderazione where id = '00000000-0000-4000-8000-0000000ca003'), 1,
          'Un''azione con un reclamo ancora conservato resta');
select is((select count(*)::int from private.tentativi_eliminazione), 0, 'I tentativi si eliminano dopo 24 ore');

-- ---------------------------------------------------------------------------------------------
-- Nuova versione dell'informativa (R-63)
-- ---------------------------------------------------------------------------------------------
select is(private.versione_corrente('privacy'), '2026-11', 'L''informativa in vigore è la 2026-11');

select * from finish();
rollback;
