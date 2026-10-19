-- RPC cerca_eventi e dettaglio_evento (DATA_MODEL.md §5.3, §5.10). Regole: R-20, R-23, R-33,
-- R-67; ADR-0018. Eventi propri tra 10 giorni, così l'esito non dipende dall'ora del test.
-- Locali: c001 Club Binario 7 (Monza), c002 Officina Lambro (Monza, solo Instagram),
-- c005 Magazzino Nove (Milano, circa 12 km), c006 non attivo.
begin;
select plan(31);

create function tests.serata() returns date language sql stable as $$
  select ((now() at time zone 'Europe/Rome') - interval '6 hours')::date + 10;
$$;

insert into public.eventi (id, locale_id, titolo, inizio, eta_minima, eta_minima_dichiarata,
                           riferimenti_alcol, stato)
values
  ('00000000-0000-4000-8000-0000000f0001', '00000000-0000-4000-8000-00000000c001', 'F1 14+',
   (tests.serata() + time '22:00') at time zone 'Europe/Rome', 14, true, false, 'pubblicato'),
  ('00000000-0000-4000-8000-0000000f0002', '00000000-0000-4000-8000-00000000c005', 'F2 16+',
   (tests.serata() + time '22:30') at time zone 'Europe/Rome', 16, true, false, 'pubblicato'),
  ('00000000-0000-4000-8000-0000000f0003', '00000000-0000-4000-8000-00000000c001', 'F3 18+',
   (tests.serata() + time '23:00') at time zone 'Europe/Rome', 18, false, false, 'pubblicato'),
  ('00000000-0000-4000-8000-0000000f0004', '00000000-0000-4000-8000-00000000c006', 'F4 locale chiuso',
   (tests.serata() + time '23:00') at time zone 'Europe/Rome', 14, true, false, 'pubblicato'),
  ('00000000-0000-4000-8000-0000000f0005', '00000000-0000-4000-8000-00000000c001', 'F5 21+',
   (tests.serata() + time '23:30') at time zone 'Europe/Rome', 21, true, false, 'pubblicato'),
  ('00000000-0000-4000-8000-0000000f0006', '00000000-0000-4000-8000-00000000c005', 'F6 alcol',
   (tests.serata() + time '23:45') at time zone 'Europe/Rome', 18, true, true, 'pubblicato'),
  ('00000000-0000-4000-8000-0000000f0007', '00000000-0000-4000-8000-00000000c002', 'F7 domani',
   (tests.serata() + 1 + time '21:00') at time zone 'Europe/Rome', 14, true, false, 'annullato');
insert into public.eventi (id, locale_id, titolo, inizio, fine, eta_minima, eta_minima_dichiarata,
                           stato)
values
  ('00000000-0000-4000-8000-0000000f0008', '00000000-0000-4000-8000-00000000c001', 'F8 finito',
   now() - interval '5 hours', now() - interval '1 minute', 14, true, 'pubblicato');
insert into public.eventi_generi (evento_id, genere_codice)
values ('00000000-0000-4000-8000-0000000f0001', 'techno'),
       ('00000000-0000-4000-8000-0000000f0001', 'house'),
       ('00000000-0000-4000-8000-0000000f0002', 'house'),
       ('00000000-0000-4000-8000-0000000f0003', 'reggaeton'),
       ('00000000-0000-4000-8000-0000000f0005', 'techno');
insert into public.eventi_fonti (evento_id, tipo_origine, url_originale, raccolto_il)
values ('00000000-0000-4000-8000-0000000f0001', 'instagram', 'https://www.instagram.com/binario7/', now()),
       ('00000000-0000-4000-8000-0000000f0001', 'sito_locale', 'https://binario7.example/f1', now() - interval '1 day');
insert into public.partecipazioni_evento (utente_id, evento_id, stato, visibile_agli_amici)
values (tests.id('minore_16'), '00000000-0000-4000-8000-0000000f0001', 'partecipo', true),
       (tests.id('adulto_20'), '00000000-0000-4000-8000-0000000f0001', 'interessato', true);
-- Copertine (ADR-0018): foto di c001, flyer di F2, nessuna immagine per F6.
update public.locali set immagine_path = id::text || '.webp', immagine_fonte = 'licenza_libera',
       immagine_attribuzione = 'Laura Bassi, CC BY 4.0', immagine_approvata_il = now()
where id = '00000000-0000-4000-8000-00000000c001';
update public.eventi set immagine_path = 'eventi/' || id::text || '.webp'
where id = '00000000-0000-4000-8000-0000000f0002';

create function tests.titoli(dal date default tests.serata(), al date default tests.serata(),
                             lat double precision default null, lon double precision default null,
                             raggio numeric default null, generi text[] default null,
                             eta_max smallint default null, amici boolean default false)
returns text[] language sql as $$
  select coalesce(array_agg(split_part(c.titolo, ' ', 1) order by c.titolo), '{}')
  from public.cerca_eventi(lat, lon, raggio, dal, al, generi, eta_max, amici) c;
$$;

-- ---------------------------------------------------------------------------------------------
-- R-20, R-23: la ricerca eredita la policy di eventi; i locali non attivi non compaiono
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select is(tests.titoli(), array['F1'], 'R-20: chi ha 14 anni trova solo i 14+ di locali attivi');
select tests.autentica_come('minore_15');
select is(tests.titoli(), array['F1'], 'R-20: chi ha 15 anni non trova i 16+');
select tests.autentica_come('minore_16');
select is(tests.titoli(), array['F1', 'F2'], 'R-20: chi ha 16 anni trova i 14+ e i 16+');
select tests.autentica_come('minore_17');
select is(tests.titoli(), array['F1', 'F2'],
          'R-20, R-21, R-23: chi ha 17 anni non trova 18+, età non dichiarata e alcol');
select tests.autentica_come('adulto_18');
select is(tests.titoli(), array['F1', 'F2', 'F3', 'F6'], 'R-20: chi ha 18 anni trova i 18+');
select tests.autentica_come('adulto_20');
select is(tests.titoli(), array['F1', 'F2', 'F3', 'F6'], 'R-20: chi ha 20 anni non trova i 21+');
select tests.autentica_come('adulto_21');
select is(tests.titoli(), array['F1', 'F2', 'F3', 'F5', 'F6'], 'R-20: chi ha 21 anni trova i 21+');

-- ---------------------------------------------------------------------------------------------
-- Filtri
-- ---------------------------------------------------------------------------------------------
select is(tests.titoli(lat => 45.5845, lon => 9.2744, raggio => 5), array['F1', 'F3', 'F5'],
          'F-01: entro 5 km da Monza restano gli eventi di Monza');
select is(tests.titoli(lat => 45.5845, lon => 9.2744, raggio => 25),
          array['F1', 'F2', 'F3', 'F5', 'F6'],
          'F-01: entro 25 km tornano anche quelli di Milano');
select ok(
  (select distanza_m between 0 and 50 from public.cerca_eventi(45.5845, 9.2744, null,
     tests.serata(), tests.serata()) where titolo = 'F1 14+'),
  'F-01: la distanza è calcolata dal punto scelto'
);
select ok(
  (select bool_and(distanza_m is null) from public.cerca_eventi(null, null, null,
     tests.serata(), tests.serata())),
  'R-33: senza posizione non c''è distanza'
);
select is(tests.titoli(generi => array['house']), array['F1', 'F2'], 'F-01: filtro per genere');
select is(tests.titoli(generi => array['house', 'reggaeton']), array['F1', 'F2', 'F3'],
          'F-01: più generi si sommano');
select is(tests.titoli(eta_max => 16::smallint), array['F1', 'F2'],
          'F-01: l''età minima restringe soltanto tra gli eventi già visibili');
select is(tests.titoli(al => tests.serata() + 1), array['F1', 'F2', 'F3', 'F5', 'F6', 'F7'],
          'F-01: l''intervallo di date comprende più serate, anche gli annullati');
select is(
  (select stato::text from public.cerca_eventi(null, null, null, tests.serata() + 1,
     tests.serata() + 1)),
  'annullato',
  'L''evento annullato resta visibile con il suo stato'
);
select ok(
  not ('F8' = any (tests.titoli(dal => tests.serata() - 11, al => tests.serata() - 9))),
  'Gli eventi già finiti non compaiono'
);
select is(tests.titoli(dal => null, al => null) && array['F1'], false,
          'Senza date si cercano gli eventi della serata in corso');

-- ---------------------------------------------------------------------------------------------
-- Amici che partecipano (F-04, R-67) e propria partecipazione (F-05)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_15');
select is(tests.titoli(amici => true), array['F1'], 'F-04: solo eventi con amici');
select is(
  (select row(amici_partecipano, amici_interessati, amici -> 0 ->> 'nome_visualizzato')::text
   from public.cerca_eventi(null, null, null, tests.serata(), tests.serata())
   where titolo = 'F1 14+'),
  '(1,0,"Minore 16")',
  'R-67: si contano e si nominano solo gli amici confermati, non l''adulto interessato'
);
select tests.autentica_come('adulto_21');
select is(
  (select row(amici_partecipano, amici_interessati)::text
   from public.cerca_eventi(null, null, null, tests.serata(), tests.serata())
   where titolo = 'F1 14+'),
  '(0,1)',
  'R-67: chi ha 21 anni vede l''amico interessato e non il minorenne che partecipa'
);
select tests.autentica_come('minore_16');
select is(
  (select mia_partecipazione::text from public.cerca_eventi(null, null, null, tests.serata(),
     tests.serata()) where titolo = 'F1 14+'),
  'partecipo',
  'F-05: la propria scelta torna con l''evento'
);

-- ---------------------------------------------------------------------------------------------
-- Copertina (ADR-0018)
-- ---------------------------------------------------------------------------------------------
select is(
  (select row(copertina_tipo, copertina_path, copertina_attribuzione)::text
   from public.cerca_eventi(null, null, null, tests.serata(), tests.serata())
   where titolo = 'F1 14+'),
  '(locale,00000000-0000-4000-8000-00000000c001.webp,"Laura Bassi, CC BY 4.0")',
  'ADR-0018: prima la foto del locale, con l''attribuzione'
);
select is(
  (select row(copertina_tipo, copertina_path)::text
   from public.cerca_eventi(null, null, null, tests.serata(), tests.serata())
   where titolo = 'F2 16+'),
  '(flyer,eventi/00000000-0000-4000-8000-0000000f0002.webp)',
  'ADR-0018: senza foto del locale, il flyer approvato'
);
select tests.autentica_come('adulto_18');
select is(
  (select copertina_tipo from public.cerca_eventi(null, null, null, tests.serata(),
     tests.serata()) where titolo = 'F6 alcol'),
  'tipografica',
  'ADR-0018: senza immagini, il fondo tipografico'
);

-- ---------------------------------------------------------------------------------------------
-- Parametri non validi
-- ---------------------------------------------------------------------------------------------
select throws_ok($$ select * from public.cerca_eventi(lat => 45.5) $$, '22023', null,
                 'Latitudine senza longitudine');
select throws_ok($$ select * from public.cerca_eventi(raggio_km => 500) $$, '22023', null,
                 'Distanza oltre i 100 km');
select throws_ok(
  $$ select * from public.cerca_eventi(dal => current_date + 3, al => current_date) $$,
  '22023', null, 'Date invertite');

-- ---------------------------------------------------------------------------------------------
-- dettaglio_evento
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_17');
select is_empty(
  $$ select 1 from public.dettaglio_evento('00000000-0000-4000-8000-0000000f0003') $$,
  'R-20: il dettaglio di un evento 18+ non esiste per chi ha 17 anni'
);
select is(
  (select row(fonte_tipo, fonte_url, jsonb_array_length(amici))::text
   from public.dettaglio_evento('00000000-0000-4000-8000-0000000f0001')),
  '(sito_locale,https://binario7.example/f1,0)',
  'F-03: la fonte più affidabile è il sito; R-67: nessun amico visibile'
);
select tests.autentica_come('adulto_18');
select is(
  (select row(fonte_tipo, fonte_url)::text
   from public.dettaglio_evento('00000000-0000-4000-8000-0000000f0003')),
  '(sito_locale,https://binario7.example)',
  'F-03: senza fonti dell''evento il link porta al sito del locale'
);

select * from finish();
rollback;
