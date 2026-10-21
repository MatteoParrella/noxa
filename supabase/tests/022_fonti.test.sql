-- fonti, esecuzioni_fonte, accodamento e "Esegui ora" (DATA_MODEL.md §5.3, §8). Regole:
-- R-06, R-69; ADR-0003, ADR-0008.
begin;
select plan(43);

-- I dati di esempio della raccolta nel seed non entrano nei conteggi dei test (rollback finale).
update public.eventi_fonti set fonte_id = null where fonte_id is not null;
delete from public.eventi_grezzi;
delete from public.esecuzioni_fonte;
delete from public.fonti;
delete from public.candidati_locali;

create function tests.f(n text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000f' || n)::uuid;
$$;
-- La fonte creata dal moderatore nel test, trovata dal suo URL.
create function tests.f3() returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.fonti where url = 'https://cascinatorretta.example/eventi';
$$;
create function tests.l(n text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000c' || n)::uuid;
$$;

-- Fonti di prova: f001 sito consentita e attiva, f002 Instagram da verificare.
insert into public.fonti (id, locale_id, tipo, url, adattatore, frequenza_minuti,
                          stato_conformita, robots_esito, termini_url, termini_letti_il, attiva)
values
  (tests.f('001'), tests.l('001'), 'sito_locale', 'https://binario7.example/eventi', 'sito_jsonld',
   360, 'consentita', 'consentito', 'https://binario7.example/termini', current_date, true),
  (tests.f('002'), tests.l('002'), 'instagram', 'officinalambro', 'instagram_business_discovery',
   720, 'da_verificare', null, null, null, false);

-- ---------------------------------------------------------------------------------------------
-- Lettura: solo moderatori con due fattori (R-06, R-69)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select is_empty($$ select 1 from public.fonti $$, 'Chi ha 14 anni non vede le fonti');
select tests.autentica_come('minore_17');
select is_empty($$ select 1 from public.fonti $$, 'Chi ha 17 anni non vede le fonti');
select tests.autentica_come('adulto_21');
select is_empty($$ select 1 from public.fonti $$, 'Chi ha 21 anni non vede le fonti');
select tests.autentica_come('moderatore_senza_mfa');
select is_empty($$ select 1 from public.fonti $$, 'R-06: senza due fattori le fonti non si vedono');
select tests.autentica_come('moderatore');
select is((select count(*)::int from public.fonti), 2, 'Un moderatore con due fattori vede le fonti');
select is(
  (select dominio from public.fonti where id = tests.f('001')),
  'binario7.example',
  'Il dominio della fonte è calcolato dall''URL'
);

-- ---------------------------------------------------------------------------------------------
-- Scrittura e conformità (ADR-0008)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_18');
select throws_ok(
  $$ insert into public.fonti (locale_id, tipo, url) values (tests.l('003'), 'sito_locale', 'https://x.example/') $$,
  '42501', null,
  'Un utente non crea fonti'
);
select tests.autentica_come('moderatore_senza_mfa');
select throws_ok(
  $$ insert into public.fonti (locale_id, tipo, url) values (tests.l('003'), 'sito_locale', 'https://x.example/') $$,
  '42501', null,
  'R-06: senza due fattori un moderatore non crea fonti'
);

select tests.autentica_come('moderatore');
select lives_ok(
  $$ insert into public.fonti (locale_id, tipo, url, adattatore)
     values (tests.l('003'), 'sito_locale', 'https://cascinatorretta.example/eventi', 'sito_jsonld') $$,
  'Un moderatore crea una fonte da verificare'
);
select is(
  (select stato_conformita::text || '/' || attiva::text from public.fonti where id = tests.f3()),
  'da_verificare/false',
  'ADR-0008: una nuova fonte è da verificare e non attiva'
);
select lives_ok(
  $$ update public.fonti set attiva = true where id = tests.f3() $$,
  'Chiedere di attivare una fonte da verificare non dà errore…'
);
select is(
  (select attiva from public.fonti where id = tests.f3()), false,
  'ADR-0008: …ma una fonte non consentita resta spenta'
);
select throws_ok(
  $$ update public.fonti set stato_conformita = 'consentita' where id = tests.f3() $$,
  '23514', null,
  'ADR-0008: "consentita" chiede l''esito di robots.txt e i termini con la data di lettura'
);
select throws_ok(
  $$ update public.fonti set stato_conformita = 'consentita', robots_esito = 'vietato',
       termini_url = 'https://cascinatorretta.example/termini', termini_letti_il = current_date
     where id = tests.f3() $$,
  '23514', null,
  'ADR-0008: un sito vietato da robots.txt non diventa consentito'
);
select lives_ok(
  $$ update public.fonti set stato_conformita = 'consentita', robots_esito = 'consentito',
       termini_url = 'https://cascinatorretta.example/termini', termini_letti_il = current_date,
       note_conformita = 'robots.txt: /eventi consentito per * e NoxaBot.'
     where id = tests.f3() $$,
  'ADR-0008: con la verifica scritta la fonte diventa consentita'
);
select is(
  (select verificata_da from public.fonti where id = tests.f3() and verificata_il is not null),
  tests.id('moderatore'),
  'ADR-0008: resta chi ha verificato la conformità e quando'
);
select throws_ok(
  $$ update public.fonti set stato_conformita = 'consentita', robots_esito = 'consentito',
       termini_url = 'https://developers.facebook.com/terms', termini_letti_il = current_date
     where id = tests.f('002') $$,
  '23514', null,
  'Instagram si legge solo con l''API ufficiale: robots.txt non si applica'
);
select lives_ok(
  $$ update public.fonti set stato_conformita = 'consentita', robots_esito = 'non_applicabile',
       termini_url = 'https://developers.facebook.com/terms', termini_letti_il = current_date
     where id = tests.f('002') $$,
  'Instagram consentito con l''API ufficiale e i termini di Meta'
);
select throws_ok(
  $$ insert into public.fonti (locale_id, tipo, url, stato_conformita, robots_esito, termini_url,
                               termini_letti_il)
     values (tests.l('004'), 'resident_advisor', 'https://ra.example/club/1', 'consentita',
             'consentito', 'https://ra.example/terms', current_date) $$,
  '23514', null,
  'D-05: un aggregatore senza accordo non diventa consentito'
);
select throws_ok(
  $$ insert into public.fonti (locale_id, tipo, url, frequenza_minuti)
     values (tests.l('004'), 'sito_locale', 'https://salaventuno.example/eventi', 120) $$,
  '23514', null,
  'Un sito si legge al massimo ogni 6 ore'
);
select throws_ok(
  $$ update public.fonti set frequenza_minuti = 360 where id = tests.f('002') $$,
  '23514', null,
  'Instagram si legge al massimo ogni 12 ore'
);
select throws_ok(
  $$ update public.fonti set pagine_massime = 51 where id = tests.f3() $$,
  '23514', null,
  'Al massimo 50 pagine per esecuzione'
);
select lives_ok(
  $$ update public.fonti set stato_conformita = 'vietata' where id = tests.f('001') $$,
  'Un moderatore segna come vietata una fonte attiva'
);
select is(
  (select attiva from public.fonti where id = tests.f('001')), false,
  'ADR-0008: una fonte vietata si spegne da sola'
);
select ok(
  (select count(*) from public.azioni_moderazione
   where oggetto_id = tests.f3() and tipo_oggetto = 'fonte'
     and moderatore_id = tests.id('moderatore')) >= 2
  and exists (select 1 from public.azioni_moderazione
              where oggetto_id = tests.f('001') and azione = 'modifica_fonte'
                and motivazione like '%Conformità: vietata%Fonte disattivata%'),
  'Le modifiche delle fonti restano nel registro, con conformità e attivazione'
);

-- ---------------------------------------------------------------------------------------------
-- Esegui ora (skill add-event-source §6)
-- ---------------------------------------------------------------------------------------------
select throws_ok(
  $$ select public.esegui_fonte_ora(tests.f('001')) $$,
  'NX022', null,
  'ADR-0008: una fonte vietata non si esegue'
);
select ok(
  public.esegui_fonte_ora(tests.f3()) is not null,
  'Un moderatore esegue subito una fonte consentita non ancora attiva'
);
select is(
  public.esegui_fonte_ora(tests.f3()),
  (select public.esegui_fonte_ora(tests.f3())),
  'Una seconda richiesta restituisce il job già in coda'
);
select tests.esci();
select is(
  (select payload ->> 'prova' || ' ' || chiave_concorrenza from public.coda_job
   where chiave_idempotenza = 'esegui_fonte:' || tests.f3()),
  'true dominio:cascinatorretta.example',
  'Il job è una prova e ha la chiave del dominio (un job alla volta per dominio)'
);
select tests.autentica_come('adulto_21');
select throws_ok(
  $$ select public.esegui_fonte_ora(tests.f3()) $$,
  '42501', null,
  'Un utente non esegue le fonti'
);
select tests.autentica_come('moderatore_senza_mfa');
select throws_ok(
  $$ select public.esegui_fonte_ora(tests.f3()) $$,
  '42501', null,
  'R-06: senza due fattori un moderatore non esegue le fonti'
);

-- ---------------------------------------------------------------------------------------------
-- Accodamento pianificato con backoff dopo gli errori (§2.4)
-- ---------------------------------------------------------------------------------------------
select tests.esci();
insert into public.fonti (id, locale_id, tipo, url, adattatore, stato_conformita, robots_esito,
                          termini_url, termini_letti_il, verificata_il, attiva,
                          ultima_esecuzione_il, errori_consecutivi)
values
  (tests.f('010'), tests.l('005'), 'sito_locale', 'https://magazzinonove.example/eventi', 'sito_jsonld',
   'consentita', 'consentito', 'https://magazzinonove.example/t', current_date, now(), true, null, 0),
  (tests.f('011'), tests.l('004'), 'sito_locale', 'https://salaventuno.example/eventi', 'sito_jsonld',
   'consentita', 'consentito', 'https://salaventuno.example/t', current_date, now(), true,
   now() - interval '30 hours', 2),
  (tests.f('012'), tests.l('006'), 'sito_locale', 'https://spazionavile.example/eventi', 'sito_jsonld',
   'consentita', 'consentito', 'https://spazionavile.example/t', current_date, now(), true,
   now() - interval '30 hours', 3);
select is(private.accoda_fonti_da_eseguire(), 2,
          'Si accodano le fonti attive scadute, con l''intervallo raddoppiato dopo gli errori');
select is(
  (select array_agg(payload ->> 'fonte_id' order by payload ->> 'fonte_id') from public.coda_job
   where tipo = 'esegui_fonte' and payload ->> 'prova' = 'false'),
  array[tests.f('010')::text, tests.f('011')::text],
  'Con 3 errori di fila una fonte aspetta 8 volte la sua frequenza'
);
select is(private.accoda_fonti_da_eseguire(), 0, 'Una fonte già in coda non si accoda di nuovo');

-- ---------------------------------------------------------------------------------------------
-- Worker: registra l'esito, può solo disattivare (ADR-0003, ADR-0008)
-- ---------------------------------------------------------------------------------------------
grant noxa_worker to postgres;
grant usage on schema tests to noxa_worker;
grant execute on function tests.f(text), tests.l(text) to noxa_worker;
set local role noxa_worker;
select is((select count(*)::int from public.fonti), 6, 'Il worker legge le fonti');
select lives_ok(
  $$ update public.fonti set ultima_esecuzione_il = now(), errori_consecutivi = 5,
       ultimo_errore = 'HTTP 503', attiva = false, disattivata_automaticamente_il = now(),
       ultimo_esito = '{"eventi_letti": 0}'
     where id = tests.f('010') $$,
  'Il worker registra l''esito e disattiva una fonte dopo 5 errori'
);
select throws_ok(
  $$ update public.fonti set attiva = true where id = tests.f('010') $$,
  'NX019', null,
  'ADR-0008: il worker non attiva le fonti'
);
select throws_ok(
  $$ update public.fonti set url = 'https://altro.example/' where id = tests.f('010') $$,
  '42501', null,
  'Il worker non cambia URL e conformità'
);
select lives_ok(
  $$ insert into public.esecuzioni_fonte (fonte_id, iniziata_il, durata_ms, pagine_lette, eventi_letti,
                                          codice_errore, messaggio_errore)
     values (tests.f('010'), now(), 8400, 3, 0, 'HTTP_503', 'Service Unavailable') $$,
  'Il worker registra l''esecuzione'
);
reset role;

select tests.autentica_come('moderatore');
select lives_ok(
  $$ update public.fonti set attiva = true where id = tests.f('010') $$,
  'Un moderatore riattiva la fonte disattivata in automatico'
);
select is(
  (select errori_consecutivi::text || '/' || (disattivata_automaticamente_il is null)::text
   from public.fonti where id = tests.f('010')),
  '0/true',
  'La riattivazione azzera gli errori di fila'
);
select is((select count(*)::int from public.esecuzioni_fonte), 1, 'Un moderatore vede le esecuzioni');
select tests.autentica_come('adulto_21');
select is_empty($$ select 1 from public.esecuzioni_fonte $$, 'Un utente non vede le esecuzioni');

select * from finish();
rollback;
