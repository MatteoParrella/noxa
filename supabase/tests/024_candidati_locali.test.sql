-- candidati_locali e decisione dei moderatori (DATA_MODEL.md §5.3; EVENT_INGESTION.md §2.1).
-- Regole: R-06; ADR-0008 (da Google solo il place_id).
begin;
select plan(18);

-- I dati di esempio della raccolta nel seed non entrano nei conteggi dei test (rollback finale).
update public.eventi_fonti set fonte_id = null where fonte_id is not null;
delete from public.eventi_grezzi;
delete from public.esecuzioni_fonte;
delete from public.fonti;
delete from public.candidati_locali;

create function tests.c(n text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$$;

insert into public.candidati_locali (id, origine, osm_id, nome, indirizzo, comune, provincia,
                                     posizione, possibile_doppione_id)
values
  (tests.c('a1'), 'osm', 'node/101', 'Club Binario Sette', 'Via dei Cantieri 12', 'Monza', 'MB',
   'SRID=4326;POINT(9.2744 45.5845)', '00000000-0000-4000-8000-00000000c001'),
  (tests.c('a2'), 'osm', 'node/102', 'Corte delle Rose', 'Via Giardini 4', 'Lissone', 'MB',
   'SRID=4326;POINT(9.24 45.61)', null);
insert into public.candidati_locali (id, origine, google_place_id)
values (tests.c('a3'), 'google', 'ChIJ-prova');

select throws_ok(
  $$ insert into public.candidati_locali (origine, google_place_id, nome)
     values ('google', 'ChIJ-altro', 'Nome da Google') $$,
  '23514', null,
  'ADR-0008: da Google Places si conserva solo il place_id'
);

select tests.autentica_come('minore_15');
select is_empty($$ select 1 from public.candidati_locali $$, 'Chi ha 15 anni non vede i candidati');
select tests.autentica_come('adulto_18');
select is_empty($$ select 1 from public.candidati_locali $$, 'Chi ha 18 anni non vede i candidati');
select throws_ok(
  $$ select public.decidi_candidato_locale(tests.c('a2'), 'scartato', null, 'Chiuso.') $$,
  '42501', null,
  'Un utente non decide i candidati'
);
select throws_ok($$ select * from public.candidati_da_verificare() $$, '42501', null,
                 'Un utente non legge l''elenco dei candidati');
select tests.autentica_come('moderatore_senza_mfa');
select is_empty($$ select 1 from public.candidati_locali $$, 'R-06: senza due fattori i candidati non si vedono');
select tests.autentica_come('moderatore');
select is((select count(*)::int from public.candidati_locali where id in (tests.c('a1'), tests.c('a2'), tests.c('a3'))), 3, 'Un moderatore vede i candidati');
select is(
  (select round(lat::numeric, 2) || ' ' || doppione_nome from public.candidati_da_verificare()
   where id = tests.c('a1')),
  '45.58 Club Binario 7',
  'L''elenco dei candidati ha coordinate e possibile doppione'
);
select throws_ok(
  $$ update public.candidati_locali set stato = 'scartato' where id = tests.c('a2') $$,
  '42501', null,
  'I candidati si decidono solo con la RPC'
);

select throws_ok(
  $$ select public.decidi_candidato_locale(tests.c('a1'), 'unito', '00000000-0000-4000-8000-00000000c001', '') $$,
  'NX021', null,
  'Unire a un locale esistente chiede la motivazione'
);
select lives_ok(
  $$ select public.decidi_candidato_locale(tests.c('a1'), 'unito', '00000000-0000-4000-8000-00000000c001',
                                           'Stesso indirizzo e stesso sito.') $$,
  'Un moderatore unisce il candidato al locale esistente'
);
select is(
  (select osm_id || ' ' || nome from public.locali where id = '00000000-0000-4000-8000-00000000c001'),
  'node/101 Club Binario 7',
  'Il locale riceve l''identificativo OSM; nessun altro dato viene sovrascritto'
);
select throws_ok(
  $$ select public.decidi_candidato_locale(tests.c('a1'), 'scartato', null, 'Di nuovo.') $$,
  'NX025', null,
  'Un candidato deciso non si decide di nuovo'
);
select throws_ok(
  $$ select public.decidi_candidato_locale(tests.c('a2'), 'scartato', null, '  ') $$,
  'NX021', null,
  'Scartare chiede il motivo'
);
select lives_ok(
  $$ select public.decidi_candidato_locale(tests.c('a2'), 'scartato', null, 'Il locale ha chiuso.') $$,
  'Un moderatore scarta un candidato con il motivo'
);
select lives_ok(
  $$ insert into public.locali (nome, indirizzo, comune, provincia, posizione)
     values ('Spazio Vetrina', 'Via Vetrina 2', 'Seregno', 'MB', 'SRID=4326;POINT(9.20 45.65)') $$,
  'Un moderatore crea il locale verificato dal candidato Google'
);
select lives_ok(
  $$ select public.decidi_candidato_locale(
       tests.c('a3'), 'creato', (select id from public.locali where nome = 'Spazio Vetrina'), null) $$,
  'Il candidato risulta verificato e creato'
);
select is(
  (select array_agg(azione::text order by azione::text) from public.azioni_moderazione
   where tipo_oggetto = 'candidato_locale' and moderatore_id = tests.id('moderatore')),
  array['scarta_candidato_locale', 'unisci_candidato_locale', 'verifica_candidato_locale'],
  'Ogni decisione sui candidati è nel registro'
);

select * from finish();
rollback;
