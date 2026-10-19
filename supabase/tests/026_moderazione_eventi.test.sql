-- RPC dell'area di moderazione per eventi e locali: elenchi, stato, possibili annullamenti,
-- registro e generi (DATA_MODEL.md §5.3, §5.10; EVENT_INGESTION.md §7). Regole: R-06, R-22,
-- R-53, R-69.
begin;
select plan(32);

create function tests.e(n text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000e' || n)::uuid;
$$;

insert into public.fonti (id, locale_id, tipo, url, adattatore, stato_conformita, robots_esito,
                          termini_url, termini_letti_il, verificata_il, attiva)
values ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000c001',
        'sito_locale', 'https://binario7.example/eventi', 'sito_jsonld', 'consentita',
        'consentito', 'https://binario7.example/termini', current_date, now(), true);

-- e020: evento tra 5 giorni, non trovato nella sua unica fonte per due esecuzioni.
insert into public.eventi (id, locale_id, titolo, inizio, eta_minima, eta_minima_dichiarata, stato)
values (tests.e('020'), '00000000-0000-4000-8000-00000000c001', 'Live in Cascina',
        now() + interval '5 days', 16, true, 'pubblicato');
insert into public.eventi_fonti (evento_id, fonte_id, tipo_origine, url_originale, assenze_consecutive)
values (tests.e('020'), '00000000-0000-4000-8000-00000000f001', 'sito_locale',
        'https://binario7.example/eventi/live', 2);
insert into public.eventi_grezzi (fonte_id, payload, hash_contenuto, stato, evento_id)
values ('00000000-0000-4000-8000-00000000f001', '{}', repeat('a', 64), 'normalizzato', tests.e('020'));

-- ---------------------------------------------------------------------------------------------
-- Accesso alle RPC (R-06)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_17');
select throws_ok($$ select * from public.eventi_moderazione() $$, '42501', null,
                 'Un utente non usa la ricerca dei moderatori');
select throws_ok($$ select * from public.locali_moderazione() $$, '42501', null,
                 'Un utente non vede l''elenco dei locali dei moderatori');
select throws_ok($$ select * from public.locale_moderazione('00000000-0000-4000-8000-00000000c001') $$,
                 '42501', null, 'Un utente non apre la scheda di moderazione di un locale');
select throws_ok($$ select * from public.contatori_moderazione() $$, '42501', null,
                 'Un utente non vede i contatori della moderazione');
select throws_ok($$ select * from public.registro_moderazione('evento', tests.e('001')) $$, '42501', null,
                 'Un utente non legge il registro');
select throws_ok($$ select public.cambia_stato_evento(tests.e('001'), 'annullato', 'x') $$, '42501', null,
                 'Un utente non annulla eventi');
select tests.autentica_come('moderatore_senza_mfa');
select throws_ok($$ select * from public.possibili_annullamenti() $$, '42501', null,
                 'R-06: senza due fattori niente possibili annullamenti');
select throws_ok($$ select public.correggi_eta_alcol_evento(tests.e('001'), 14::smallint, true, false, 'x') $$,
                 '42501', null, 'R-06: senza due fattori niente correzioni d''età');

-- ---------------------------------------------------------------------------------------------
-- Elenchi
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('moderatore');
select is(
  (select array_agg(id order by id) from public.eventi_moderazione('binario')),
  array[tests.e('001'), tests.e('004'), tests.e('020')],
  'La ricerca trova gli eventi per titolo o per nome del locale'
);
select is(
  (select array_agg(id) from public.eventi_moderazione(null, array['in_revisione']::public.stato_evento[])),
  array[tests.e('010')],
  'Il filtro per stato mostra gli eventi in revisione'
);
select is(
  (select fonti_totali || '/' || fonti_attive || '/' || eventi_7_giorni
   from public.locali_moderazione() where nome = 'Club Binario 7'),
  '1/1/3',
  'L''elenco dei locali conta fonti, fonti attive ed eventi dei prossimi 7 giorni'
);
select is(
  (select round(lat::numeric, 4) || ' ' || round(lon::numeric, 4) || ' ' || nome
   from public.locale_moderazione('00000000-0000-4000-8000-00000000c001')),
  '45.5845 9.2744 Club Binario 7',
  'La scheda del locale ha le coordinate per la mappa'
);
select is(
  (select attivo from public.locali_moderazione() where nome = 'Spazio Navile'),
  false,
  'L''elenco dei moderatori comprende i locali non attivi'
);
select is(
  (select duplicati || '/' || possibili_annullamenti || '/' || candidati_locali
   from public.contatori_moderazione()),
  '0/1/0',
  'I contatori della navigazione laterale'
);

-- ---------------------------------------------------------------------------------------------
-- Stato degli eventi
-- ---------------------------------------------------------------------------------------------
select throws_ok($$ select public.cambia_stato_evento(tests.e('001'), 'annullato', ' ') $$, 'NX021', null,
                 'Annullare chiede la motivazione');
select throws_ok($$ select public.cambia_stato_evento(tests.e('010'), 'annullato', 'Rimandato.') $$,
                 'NX026', null, 'Si annulla solo un evento pubblicato');
select lives_ok(
  $$ select public.cambia_stato_evento(tests.e('001'), 'annullato', 'Il locale ha rimandato la serata.') $$,
  'Un moderatore annulla un evento con la motivazione'
);
select lives_ok($$ select public.cambia_stato_evento(tests.e('001'), 'pubblicato', null) $$,
                'Un evento annullato per errore torna pubblicato');
select lives_ok(
  $$ select public.cambia_stato_evento(tests.e('010'), 'rifiutato', 'Non è un evento serale.') $$,
  'Un moderatore rifiuta un evento in revisione'
);
select tests.autentica_come('adulto_21');
select is_empty($$ select 1 from public.eventi where id = tests.e('010') $$,
                'Un evento rifiutato non si vede');

-- ---------------------------------------------------------------------------------------------
-- Possibili annullamenti (EVENT_INGESTION.md §7)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('moderatore');
select is(
  (select evento_id::text || ' ' || ha_partecipanti::text from public.possibili_annullamenti()),
  tests.e('020')::text || ' false',
  'L''evento non trovato due volte nella sua unica fonte è un possibile annullamento'
);
select lives_ok(
  $$ select public.decidi_possibile_annullamento(tests.e('020'), false, null) $$,
  '"È ancora in programma"'
);
select is_empty($$ select 1 from public.possibili_annullamenti() $$,
                'Confermato in programma, l''evento esce dall''elenco');
select throws_ok($$ select public.decidi_possibile_annullamento(tests.e('020'), true, 'x') $$, 'NX025', null,
                 'Non si decide un evento che non è un possibile annullamento');
select tests.esci();
update public.eventi_fonti set assenze_consecutive = 3 where evento_id = tests.e('020');
select tests.autentica_come('moderatore');
select lives_ok(
  $$ select public.decidi_possibile_annullamento(tests.e('020'), true, 'Sparito dal sito e confermato dal locale.') $$,
  '"Conferma annullamento" con la motivazione'
);
select is((select stato::text from public.eventi where id = tests.e('020')), 'annullato',
          'L''evento risulta annullato');

-- ---------------------------------------------------------------------------------------------
-- Registro e modifiche dirette (nessuna azione silenziosa)
-- ---------------------------------------------------------------------------------------------
select lives_ok(
  $$ update public.eventi set titolo = 'Notte Ferrovia (sala grande)', fine = fine + interval '1 hour'
     where id = tests.e('001') $$,
  'Un moderatore corregge titolo e orario di fine'
);
select is(
  (select autore || ': ' || motivazione from public.registro_moderazione('evento', tests.e('001'))
   where azione = 'modifica_evento'),
  'Moderatore: Campi modificati: fine, titolo.',
  'La modifica diretta finisce nel registro con il nome del moderatore'
);
select is(
  (select array_agg(azione order by azione) from public.registro_moderazione('evento', tests.e('020'))),
  array['annulla_evento', 'conferma_in_programma', 'evento_creato'],
  'Il registro dell''evento comprende le operazioni della raccolta ("Sistema")'
);
select lives_ok(
  $$ insert into public.eventi_generi (evento_id, genere_codice) values (tests.e('001'), 'elettronica') $$,
  'Un moderatore aggiunge un genere'
);
select lives_ok(
  $$ delete from public.eventi_generi where evento_id = tests.e('001') and genere_codice = 'house' $$,
  'Un moderatore toglie un genere'
);
select tests.autentica_come('moderatore_senza_mfa');
select throws_ok(
  $$ insert into public.eventi_generi (evento_id, genere_codice) values (tests.e('002'), 'techno') $$,
  '42501', null,
  'R-06: senza due fattori un moderatore non cambia i generi'
);

select * from finish();
rollback;
