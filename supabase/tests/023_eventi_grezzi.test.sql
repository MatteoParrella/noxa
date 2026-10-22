-- eventi_grezzi, coda dei duplicati e decisione del moderatore (DATA_MODEL.md §5.3;
-- EVENT_INGESTION.md §6.4). Regole: R-06, R-69; ADR-0003.
begin;
select plan(23);

-- I dati di esempio della raccolta nel seed non entrano nei conteggi dei test (rollback finale).
update public.eventi_fonti set fonte_id = null where fonte_id is not null;
delete from public.eventi_grezzi;
delete from public.esecuzioni_fonte;
delete from public.fonti;
delete from public.candidati_locali;

create function tests.g(n text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000d' || n)::uuid;
$$;

insert into public.fonti (id, locale_id, tipo, url, adattatore, stato_conformita, robots_esito,
                          termini_url, termini_letti_il, verificata_il, attiva)
values ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000c001',
        'sito_locale', 'https://binario7.example/eventi', 'sito_jsonld', 'consentita',
        'consentito', 'https://binario7.example/termini', current_date, now(), true);

-- d001: possibile duplicato di e001 (Notte Ferrovia); d002: già unito; d003: in revisione senza
-- candidato ("locale non riconosciuto").
insert into public.eventi_grezzi (id, fonte_id, payload, hash_contenuto, stato, evento_id,
                                  evento_candidato_id, punteggio_dedup, nota_revisione)
values
  (tests.g('001'), '00000000-0000-4000-8000-00000000f001',
   '{"titolo": "NOTTE FERROVIA – techno all night", "riferimenti_alcol": true}',
   repeat('a', 64), 'in_revisione_dedup', null, '00000000-0000-4000-8000-00000000e001', 82,
   'Stesso locale, orario a 30 minuti, titolo simile'),
  (tests.g('002'), '00000000-0000-4000-8000-00000000f001', '{"titolo": "Indie al Binario"}',
   repeat('b', 64), 'unito', '00000000-0000-4000-8000-00000000e004', null, null, null),
  (tests.g('003'), '00000000-0000-4000-8000-00000000f001', '{"titolo": "Open Decks Vol. 3"}',
   repeat('c', 64), 'in_revisione_dedup', null, null, 64, 'Locale non riconosciuto');

-- ---------------------------------------------------------------------------------------------
-- Lettura (R-06, R-69)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select is_empty($$ select 1 from public.eventi_grezzi $$, 'Chi ha 16 anni non vede i grezzi');
select tests.autentica_come('adulto_20');
select is_empty($$ select 1 from public.eventi_grezzi $$, 'Chi ha 20 anni non vede i grezzi');
select throws_ok($$ select * from public.coda_duplicati() $$, '42501', null,
                 'Un utente non vede la coda dei duplicati');
select tests.autentica_come('moderatore_senza_mfa');
select is_empty($$ select 1 from public.eventi_grezzi $$, 'R-06: senza due fattori i grezzi non si vedono');
select throws_ok($$ select * from public.coda_duplicati() $$, '42501', null,
                 'R-06: senza due fattori la coda dei duplicati non si apre');
select tests.autentica_come('moderatore');
select is((select count(*)::int from public.eventi_grezzi), 3, 'Un moderatore vede i grezzi');
select is(
  (select array_agg(grezzo_id order by creato_il, grezzo_id) from public.coda_duplicati()),
  array[tests.g('001'), tests.g('003')],
  'La coda contiene solo i grezzi in revisione non ancora decisi'
);
select is(
  (select candidato ->> 'titolo' || ' · ' || (candidato ->> 'locale_nome') || ' · '
          || (candidato ->> 'generi')
   from public.coda_duplicati() where grezzo_id = tests.g('001')),
  'Notte Ferrovia · Club Binario 7 · ["house", "techno"]',
  'Il candidato arriva con locale e generi per il confronto affiancato'
);
select throws_ok(
  $$ update public.eventi_grezzi set stato = 'unito' where id = tests.g('001') $$,
  '42501', null,
  'Le decisioni passano solo dalla RPC, che le registra'
);

-- ---------------------------------------------------------------------------------------------
-- Decisione (EVENT_INGESTION.md §6.4)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_20');
select throws_ok($$ select public.decidi_duplicato(tests.g('001'), true) $$, '42501', null,
                 'Un utente non decide i duplicati');
select tests.autentica_come('moderatore');
select throws_ok($$ select public.decidi_duplicato(tests.g('002'), true) $$, 'NX025', null,
                 'Un grezzo già unito non si decide di nuovo');
select throws_ok($$ select public.decidi_duplicato(tests.g('003'), true) $$, '22023', null,
                 'Senza un evento candidato non si unisce');
select lives_ok($$ select public.decidi_duplicato(tests.g('001'), true) $$,
                'Un moderatore decide "stesso evento"');
select is(
  (select decisione || ' ' || (deciso_da = tests.id('moderatore'))::text
   from public.eventi_grezzi where id = tests.g('001')),
  'stesso_evento true',
  'La decisione resta sul grezzo con chi l''ha presa'
);
select throws_ok($$ select public.decidi_duplicato(tests.g('001'), false) $$, 'NX025', null,
                 'Una decisione presa non si cambia dalla coda');
select is_empty(
  $$ select 1 from public.coda_duplicati() where grezzo_id = tests.g('001') $$,
  'Il grezzo deciso esce dalla coda'
);
select is(
  (select motivazione from public.azioni_moderazione
   where oggetto_id = '00000000-0000-4000-8000-00000000e001' and azione = 'unisci_duplicato'
     -- Solo la riga di questo test: il database locale può avere decisioni prese a mano.
     and creata_il = now()),
  'Stesso evento: dati della nuova fonte uniti (punteggio 82).',
  'La decisione è nel registro dell''evento'
);
select lives_ok($$ select public.decidi_duplicato(tests.g('003'), false) $$,
                'Un moderatore decide "eventi distinti" anche senza candidato');
select tests.esci();
select is(
  (select array_agg(payload ->> 'grezzo_id' order by id) from public.coda_job
   where tipo = 'deduplica_grezzo' and creato_il = now()),
  array[tests.g('001')::text, tests.g('003')::text],
  'Ogni decisione accoda il job deduplica_grezzo per il worker'
);

-- ---------------------------------------------------------------------------------------------
-- Worker (ADR-0003)
-- ---------------------------------------------------------------------------------------------
grant noxa_worker to postgres;
grant usage on schema tests to noxa_worker;
grant execute on function tests.g(text) to noxa_worker;
set local role noxa_worker;
select lives_ok(
  $$ insert into public.eventi_grezzi (fonte_id, payload, hash_contenuto, stato)
     values ('00000000-0000-4000-8000-00000000f001', '{}', repeat('d', 64), 'nuovo') $$,
  'Il worker registra un grezzo'
);
select throws_ok(
  $$ insert into public.eventi_grezzi (fonte_id, payload, hash_contenuto, stato)
     values ('00000000-0000-4000-8000-00000000f001', '{}', repeat('d', 64), 'nuovo') $$,
  '23505', null,
  'La stessa pagina riletta senza modifiche non produce un altro grezzo'
);
select lives_ok(
  $$ update public.eventi_grezzi set stato = 'unito', evento_id = '00000000-0000-4000-8000-00000000e001'
     where id = tests.g('001') $$,
  'Il worker applica la decisione'
);
select throws_ok(
  $$ delete from public.eventi_grezzi where id = tests.g('001') $$,
  '42501', null,
  'Il worker non elimina i grezzi: la conservazione è di pg_cron'
);
reset role;

select * from finish();
rollback;
