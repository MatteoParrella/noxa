-- serate_tracker, tracker_spese, tracker_dj, tracker_amici (DATA_MODEL.md §5.6) e RPC del
-- diario: privato per tutti, moderatori compresi; alcolici solo per i maggiorenni; eventi solo
-- se visibili; data mai nel futuro; amici solo confermati.
-- Regole: R-17, R-20, R-23, R-40, R-69. Trigger: prepara_serata_tracker, verifica_categoria_spesa.
begin;
select plan(74);

-- Eventi passati di prova, indipendenti dalla data del seed.
insert into public.eventi (id, locale_id, titolo, inizio, fine, eta_minima, eta_minima_dichiarata,
                           riferimenti_alcol, stato)
values
  ('00000000-0000-4000-8000-00000000f814', '00000000-0000-4000-8000-00000000c002', 'Diario 14',
   now() - interval '3 days', now() - interval '3 days' + interval '4 hours', 14, true, false, 'pubblicato'),
  ('00000000-0000-4000-8000-00000000f816', '00000000-0000-4000-8000-00000000c001', 'Diario 16',
   now() - interval '5 days', now() - interval '5 days' + interval '4 hours', 16, true, false, 'pubblicato'),
  ('00000000-0000-4000-8000-00000000f818', '00000000-0000-4000-8000-00000000c001', 'Diario 18',
   now() - interval '5 days', now() - interval '5 days' + interval '4 hours', 18, true, false, 'pubblicato'),
  ('00000000-0000-4000-8000-00000000f819', '00000000-0000-4000-8000-00000000c005', 'Diario alcol',
   now() - interval '6 days', now() - interval '6 days' + interval '4 hours', 16, true, true, 'pubblicato'),
  ('00000000-0000-4000-8000-00000000f821', '00000000-0000-4000-8000-00000000c004', 'Diario 21',
   now() - interval '7 days', now() - interval '7 days' + interval '4 hours', 21, true, false, 'pubblicato'),
  ('00000000-0000-4000-8000-00000000f822', '00000000-0000-4000-8000-00000000c002', 'Diario futuro',
   now() + interval '3 days', now() + interval '3 days 4 hours', 14, true, false, 'pubblicato');

create function tests.ev8(n text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000f' || n)::uuid;
$$;
-- Identificativi delle serate, come li creerebbe il dispositivo.
create function tests.voce(n text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-0000000d' || lpad(n, 4, '0'))::uuid;
$$;
grant execute on function tests.ev8(text) to authenticated;
grant execute on function tests.voce(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Struttura e RLS
-- ---------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.serate_tracker'::regclass), 'RLS su serate_tracker');
select ok((select relrowsecurity from pg_class where oid = 'public.tracker_spese'::regclass), 'RLS su tracker_spese');
select ok((select relrowsecurity from pg_class where oid = 'public.tracker_dj'::regclass), 'RLS su tracker_dj');
select ok((select relrowsecurity from pg_class where oid = 'public.tracker_amici'::regclass), 'RLS su tracker_amici');

-- ---------------------------------------------------------------------------------------------
-- Ogni età salva una serata libera; R-40 per categoria e per età
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object(
       'id', tests.voce('14'), 'data_serata', current_date - 2, 'nome_locale_libero', 'Festa da Luca',
       'voto', 4, 'note', 'Bella serata',
       'spese', jsonb_build_array(jsonb_build_object('categoria', 'ingresso', 'importo_centesimi', 500)),
       'dj', jsonb_build_array('Lanterna'))) $$,
  '14 anni: salva una serata libera con spese, DJ, voto e note');
select throws_ok(
  $$ select public.salva_serata_diario(jsonb_build_object(
       'id', tests.voce('14'), 'data_serata', current_date - 2,
       'spese', jsonb_build_array(jsonb_build_object('categoria', 'alcolici', 'importo_centesimi', 500)))) $$,
  '23514', null, 'R-40: 14 anni, la categoria alcolici non esiste');

select tests.autentica_come('minore_15');
select throws_ok(
  $$ select public.salva_serata_diario(jsonb_build_object(
       'id', tests.voce('15'), 'data_serata', current_date - 1,
       'spese', jsonb_build_array(jsonb_build_object('categoria', 'alcolici', 'importo_centesimi', 100)))) $$,
  '23514', null, 'R-40: 15 anni, la categoria alcolici non esiste');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object(
       'id', tests.voce('15'), 'data_serata', current_date - 1,
       'spese', jsonb_build_array(jsonb_build_object('categoria', 'bevande_analcoliche', 'importo_centesimi', 300)))) $$,
  '15 anni: le bevande analcoliche sono ammesse');

select tests.autentica_come('minore_16');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('16'), 'data_serata', current_date - 1)) $$,
  '16 anni: serata con la sola data');
select throws_ok(
  $$ insert into public.tracker_spese (serata_tracker_id, categoria, importo_centesimi)
     values (tests.voce('16'), 'alcolici', 800) $$,
  '23514', null, 'R-40: 16 anni, nemmeno con un inserimento diretto');

select tests.autentica_come('minore_17');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object(
       'id', tests.voce('17'), 'data_serata', current_date - 1,
       'spese', jsonb_build_array(jsonb_build_object('categoria', 'trasporto', 'importo_centesimi', 460)))) $$,
  '17 anni: salva una spesa di trasporto');
select throws_ok(
  $$ update public.tracker_spese set categoria = 'alcolici' where serata_tracker_id = tests.voce('17') $$,
  '42501', null, 'R-40: 17 anni, la categoria non si cambia (colonna non modificabile)');

select tests.autentica_come('adulto_18');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object(
       'id', tests.voce('18'), 'data_serata', current_date - 1,
       'spese', jsonb_build_array(jsonb_build_object('categoria', 'alcolici', 'importo_centesimi', 800)))) $$,
  'R-40: 18 anni, la categoria alcolici è disponibile');

select tests.autentica_come('adulto_20');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object(
       'id', tests.voce('20'), 'data_serata', current_date - 1,
       'spese', jsonb_build_array(jsonb_build_object('categoria', 'alcolici', 'importo_centesimi', 1200),
                                  jsonb_build_object('categoria', 'guardaroba', 'importo_centesimi', 200)))) $$,
  'R-40: 20 anni, alcolici e guardaroba');

select tests.autentica_come('adulto_21');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object(
       'id', tests.voce('21'), 'data_serata', current_date - 1,
       'spese', jsonb_build_array(jsonb_build_object('categoria', 'alcolici', 'importo_centesimi', 1500)))) $$,
  'R-40: 21 anni, la categoria alcolici è disponibile');
select throws_ok(
  $$ select public.salva_serata_diario(jsonb_build_object(
       'id', tests.voce('22'), 'data_serata', current_date - 1,
       'spese', jsonb_build_array(jsonb_build_object('categoria', 'cibo', 'importo_centesimi', 100001)))) $$,
  '23514', null, 'Un importo oltre 1.000 € è rifiutato');
select throws_ok(
  $$ select public.salva_serata_diario(jsonb_build_object(
       'id', tests.voce('22'), 'data_serata', current_date - 1,
       'spese', jsonb_build_array(jsonb_build_object('categoria', 'cibo', 'importo_centesimi', 0)))) $$,
  '23514', null, 'Un importo di zero è rifiutato');
select throws_ok(
  $$ select public.salva_serata_diario(jsonb_build_object(
       'id', tests.voce('22'), 'data_serata', current_date - 1, 'nome_locale_libero', repeat('x', 81))) $$,
  '23514', null, 'Un nome del locale oltre 80 caratteri è rifiutato');
select throws_ok(
  $$ select public.salva_serata_diario(jsonb_build_object(
       'id', tests.voce('22'), 'data_serata', current_date - 1, 'voto', 6)) $$,
  '23514', null, 'Un voto oltre 5 è rifiutato');
select throws_ok(
  $$ select public.salva_serata_diario(jsonb_build_object(
       'id', tests.voce('22'), 'data_serata', current_date - 1, 'note', repeat('n', 1001))) $$,
  '23514', null, 'Note oltre 1000 caratteri rifiutate');

select tests.autentica_come('moderatore');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('90'), 'data_serata', current_date - 1)) $$,
  'Un moderatore ha il suo diario come tutti');
select tests.autentica_come('moderatore_senza_mfa');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('91'), 'data_serata', current_date - 1)) $$,
  'Anche senza due fattori il proprio diario funziona');

-- ---------------------------------------------------------------------------------------------
-- Data mai nel futuro (NX046)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_20');
select throws_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('23'), 'data_serata', current_date + 2)) $$,
  'NX046', null, 'Una data futura è rifiutata');
select throws_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('23'), 'evento_id', tests.ev8('822'),
                                                          'data_serata', current_date - 1)) $$,
  'NX046', null, 'Un evento futuro porta la sua data e quindi è rifiutato');

-- ---------------------------------------------------------------------------------------------
-- Eventi: solo se visibili (R-20, R-23); la data e il locale vengono dall'evento
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('140'), 'evento_id', tests.ev8('814'),
                                                          'data_serata', current_date - 20)) $$,
  '14 anni: annota un evento 14+ passato');
select is(
  (select data_serata from public.serate_tracker where id = tests.voce('140')),
  (select data_serata from public.eventi where id = tests.ev8('814')),
  'La data della serata è quella dell''evento');
select is(
  (select locale_id from public.serate_tracker where id = tests.voce('140')),
  '00000000-0000-4000-8000-00000000c002'::uuid,
  'Il locale della serata è quello dell''evento');
select throws_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('141'), 'evento_id', tests.ev8('816'),
                                                          'data_serata', current_date - 1)) $$,
  '42501', null, 'R-20: 14 anni, un evento 16+ non si annota');

select tests.autentica_come('minore_16');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('160'), 'evento_id', tests.ev8('816'),
                                                          'data_serata', current_date - 1)) $$,
  '16 anni: annota un evento 16+');
select throws_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('161'), 'evento_id', tests.ev8('819'),
                                                          'data_serata', current_date - 1)) $$,
  '42501', null, 'R-23: 16 anni, un evento 16+ con riferimenti all''alcol non si annota');
select throws_ok(
  $$ insert into public.serate_tracker (id, data_serata, evento_id)
     values (tests.voce('162'), current_date - 1, tests.ev8('818')) $$,
  '42501', null, 'R-20: 16 anni, nemmeno con un inserimento diretto di un evento 18+');
select throws_ok(
  $$ update public.serate_tracker set evento_id = tests.ev8('818') where id = tests.voce('16') $$,
  '42501', null, 'R-20: 16 anni, un evento 18+ non si aggiunge modificando la serata');

select tests.autentica_come('minore_17');
select throws_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('170'), 'evento_id', tests.ev8('818'),
                                                          'data_serata', current_date - 1)) $$,
  '42501', null, 'R-20: 17 anni, un evento 18+ non si annota');

select tests.autentica_come('adulto_18');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('180'), 'evento_id', tests.ev8('819'),
                                                          'data_serata', current_date - 1)) $$,
  'R-23: 18 anni, un evento con riferimenti all''alcol si annota');

select tests.autentica_come('adulto_20');
select throws_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('200'), 'evento_id', tests.ev8('821'),
                                                          'data_serata', current_date - 1)) $$,
  '42501', null, 'R-20: 20 anni, un evento 21+ non si annota');

select tests.autentica_come('adulto_21');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('210'), 'evento_id', tests.ev8('821'),
                                                          'data_serata', current_date - 1)) $$,
  '21 anni: annota un evento 21+');

-- Un evento ritirato dopo l'annotazione non impedisce di modificare la serata.
select tests.esci();
update public.eventi set stato = 'rifiutato' where id = tests.ev8('816');
select tests.autentica_come('minore_16');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('160'), 'evento_id', tests.ev8('816'),
                                                          'data_serata', current_date - 1, 'voto', 3)) $$,
  'Una serata con un evento poi ritirato resta modificabile');
select is(
  (select jsonb_typeof(x -> 'evento') from jsonb_array_elements(public.mio_diario()) x
   where (x ->> 'id')::uuid = tests.voce('160')),
  'null', 'mio_diario non mostra un evento non più visibile');
select tests.esci();
update public.eventi set stato = 'pubblicato' where id = tests.ev8('816');

-- ---------------------------------------------------------------------------------------------
-- R-69: privato per tutti, moderatori compresi
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_20');
select is((select count(*)::int from public.serate_tracker where utente_id <> tests.id('adulto_20')), 0,
          'Un adulto non vede le serate degli altri');
select is((select count(*)::int from public.tracker_spese sp
           where not exists (select 1 from public.serate_tracker s where s.id = sp.serata_tracker_id)), 0,
          'Un adulto non vede le spese degli altri');
select throws_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('14'), 'data_serata', current_date - 1)) $$,
  '42501', null, 'Il salvataggio con l''identificativo di un''altra persona non sovrascrive la sua serata');
select throws_ok(
  $$ insert into public.tracker_spese (serata_tracker_id, categoria, importo_centesimi)
     values (tests.voce('14'), 'cibo', 100) $$,
  '42501', null, 'Non si aggiungono spese alla serata di un altro');
select throws_ok(
  $$ insert into public.tracker_dj (serata_tracker_id, nome_dj) values (tests.voce('14'), 'Intruso') $$,
  '42501', null, 'Non si aggiungono DJ alla serata di un altro');
update public.serate_tracker set voto = 1 where id = tests.voce('14');
delete from public.serate_tracker where id = tests.voce('14');
select tests.esci();
select is((select voto from public.serate_tracker where id = tests.voce('14')), 4::smallint,
          'Né modifica né eliminazione della serata di un altro');

select tests.autentica_come('moderatore');
select is((select count(*)::int from public.serate_tracker where utente_id <> tests.id('moderatore')), 0,
          'R-69: un moderatore con due fattori non vede il diario degli altri');
select is((select count(*)::int from public.tracker_dj), 0, 'R-69: né i DJ');
select is((select count(*)::int from public.tracker_amici), 0, 'R-69: né gli amici indicati');
select tests.autentica_come('minore_16');
select is((select count(*)::int from public.serate_tracker), 2, '16 anni: vede solo le sue due serate');

-- ---------------------------------------------------------------------------------------------
-- Amici presenti: solo confermati, senza blocchi; restano se l'amicizia finisce
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_15');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('15'), 'data_serata', current_date - 1,
                                                          'amici', jsonb_build_array(tests.id('minore_16')))) $$,
  '15 anni: indica un amico confermato');
select throws_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('15'), 'data_serata', current_date - 1,
                                                          'amici', jsonb_build_array(tests.id('minore_16'), tests.id('minore_14')))) $$,
  '42501', null, 'R-11: una persona con la richiesta in attesa non si indica');
select throws_ok(
  $$ insert into public.tracker_amici (serata_tracker_id, amico_id) values (tests.voce('15'), tests.id('adulto_21')) $$,
  '42501', null, 'R-10: un adulto sconosciuto non si indica');
select is(
  (select count(*)::int from public.notifiche where creata_il > now() - interval '1 minute'), 0,
  'Indicare un amico non crea notifiche');

select tests.autentica_come('minore_16');
select is((select count(*)::int from public.tracker_amici), 0,
          'L''amico indicato non vede la voce del diario');

select tests.autentica_come('adulto_18');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('181'), 'data_serata', current_date - 1,
                                                          'amici', jsonb_build_array(tests.id('minore_17')))) $$,
  '18 anni: indica l''amico minorenne conosciuto con il codice invito');
select tests.autentica_come('minore_17');
insert into public.blocchi (bloccante_id, bloccato_id) values (tests.id('minore_17'), tests.id('adulto_18'));
select tests.autentica_come('adulto_18');
select is(
  (select (x ->> 'amici_altri')::int from jsonb_array_elements(public.mio_diario()) x
   where (x ->> 'id')::uuid = tests.voce('181')),
  1, 'R-17: dopo un blocco la persona non si vede più, resta solo contata');
select is(
  (select x -> 'amici' from jsonb_array_elements(public.esporta_miei_dati() -> 'diario') x
   where x ->> 'data_serata' = (current_date - 1)::text and jsonb_array_length(x -> 'amici') > 0),
  null, 'R-17: chi ti ha bloccato non compare nemmeno nell''esportazione');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('181'), 'data_serata', current_date - 1,
                                                          'voto', 2, 'amici', jsonb_build_array(tests.id('minore_17')))) $$,
  'La serata si modifica anche se un amico indicato non lo è più');
select throws_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('182'), 'data_serata', current_date - 1,
                                                          'amici', jsonb_build_array(tests.id('minore_17')))) $$,
  '42501', null, 'R-17: chi ti ha bloccato non si indica in una serata nuova');

-- ---------------------------------------------------------------------------------------------
-- Salvataggio idempotente e sostituzione dei figli
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_20');
select lives_ok(
  $$ select public.salva_serata_diario(jsonb_build_object(
       'id', tests.voce('20'), 'data_serata', current_date - 1,
       'spese', jsonb_build_array(jsonb_build_object('categoria', 'guardaroba', 'importo_centesimi', 250)),
       'dj', jsonb_build_array('Otto Fili'))) $$,
  'Lo stesso salvataggio ripetuto aggiorna la serata');
select is((select count(*)::int from public.serate_tracker where id = tests.voce('20')), 1, 'Nessun doppione');
select is((select array_agg(categoria::text) from public.tracker_spese where serata_tracker_id = tests.voce('20')),
          array['guardaroba'], 'Le spese tolte spariscono');
select is((select importo_centesimi from public.tracker_spese where serata_tracker_id = tests.voce('20')), 250,
          'L''importo si aggiorna');
select is((select array_agg(nome_dj) from public.tracker_dj where serata_tracker_id = tests.voce('20')),
          array['Otto Fili'], 'I DJ si sostituiscono');
select throws_ok(
  $$ select public.salva_serata_diario(jsonb_build_object('id', tests.voce('24'), 'data_serata', current_date - 1,
       'dj', (select jsonb_agg('dj ' || n) from generate_series(1, 21) n))) $$,
  '23514', null, 'Al massimo 20 DJ per serata');

-- ---------------------------------------------------------------------------------------------
-- Ricerca per il campo «Dove»
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select ok(exists (select 1 from public.cerca_per_diario('Diario 16') where id = tests.ev8('816')),
          '16 anni trova un evento passato 16+');
select ok(not exists (select 1 from public.cerca_per_diario('Diario') where id in (tests.ev8('818'), tests.ev8('819'), tests.ev8('821'))),
          'R-20, R-23: la ricerca non mostra eventi 18+, con alcol o 21+ a 16 anni');
select ok(not exists (select 1 from public.cerca_per_diario('Diario futuro')),
          'La ricerca non mostra eventi futuri');
select ok(exists (select 1 from public.cerca_per_diario('Binario') where tipo = 'locale'),
          'La ricerca trova i locali del catalogo');
select is((select count(*)::int from public.cerca_per_diario('%')), 0, 'Un carattere solo non cerca');

-- ---------------------------------------------------------------------------------------------
-- Categorie disponibili (R-40): l'app mostra quelle che riceve
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select ok(not exists (select 1 from public.categorie_spesa_disponibili() c where c = 'alcolici'),
          'R-40: 14 anni, alcolici non tra le categorie');
select tests.autentica_come('minore_17');
select is((select count(*)::int from public.categorie_spesa_disponibili()), 7,
          'R-40: 17 anni, sette categorie senza alcolici');
select tests.autentica_come('adulto_18');
select is((select count(*)::int from public.categorie_spesa_disponibili()), 8,
          '18 anni: tutte le otto categorie');
select tests.autentica_come('adulto_21');
select ok(exists (select 1 from public.categorie_spesa_disponibili() c where c = 'alcolici'),
          '21 anni: alcolici tra le categorie');

-- ---------------------------------------------------------------------------------------------
-- Eliminazione a cascata
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_20');
delete from public.serate_tracker where id = tests.voce('20');
select tests.esci();
select is((select count(*)::int from public.tracker_spese where serata_tracker_id = tests.voce('20')), 0,
          'Eliminando la serata spariscono le spese');

select * from finish();
rollback;
