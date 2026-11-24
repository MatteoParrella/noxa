-- Gestione di servizi_trasporto dall'area di moderazione (DATA_MODEL.md §5.5, ADR-0034).
-- Regole: R-04, R-06, R-69.
begin;
select plan(13);

-- Chi non è moderatore con due fattori non gestisce le voci.
select tests.autentica_come('adulto_21');
select throws_ok($$ select * from public.servizi_trasporto_moderazione() $$, '42501', null,
                 'R-06: un utente non legge l''elenco completo dei servizi');
select throws_ok(
  $$ select public.salva_servizio_trasporto(null, 'taxi', 'Taxi di prova', 'milano', '+39021234567',
       null, null, 14::smallint, 60::smallint, 'https://comune.milano.it/taxi', current_date, true,
       'Prova') $$,
  '42501', null, 'R-06: un utente non crea un servizio');
select tests.autentica_come('moderatore_senza_mfa');
select throws_ok($$ select * from public.servizi_trasporto_moderazione() $$, '42501', null,
                 'R-06: senza due fattori un moderatore non gestisce i servizi');

select tests.autentica_come('moderatore');
select ok((select count(*) from public.servizi_trasporto_moderazione()) >= 5,
          'Un moderatore con due fattori vede tutte le voci, anche quelle 18+');

create temporary table nuovo on commit drop as
select public.salva_servizio_trasporto(null, 'taxi', 'Taxi di prova', 'milano', '+39021234567',
       null, 'Taxi di prova a Milano.', 14::smallint, 60::smallint, 'https://comune.milano.it/taxi',
       current_date, true, 'Numero verificato sul sito del Comune') as id;
select ok((select id from nuovo) is not null, 'Un moderatore crea un servizio');
select is(
  (select azione::text || ': ' || motivazione from public.azioni_moderazione
   where tipo_oggetto = 'servizio_trasporto' and oggetto_id = (select id from nuovo)),
  'crea_servizio_trasporto: Numero verificato sul sito del Comune',
  'R-69: la creazione è registrata con la motivazione'
);

select throws_ok(
  $$ select public.salva_servizio_trasporto((select id from nuovo), 'taxi', 'Taxi di prova',
       'milano', '+39021234567', null, null, 14::smallint, 60::smallint,
       'https://comune.milano.it/taxi', current_date, true, '') $$,
  'NX021', null, 'R-69: ogni modifica chiede una motivazione');
select throws_ok(
  $$ select public.salva_servizio_trasporto((select id from nuovo), 'taxi', 'Taxi di prova',
       'milano', '+39021234567', null, null, 14::smallint, 60::smallint,
       'https://comune.milano.it/taxi', current_date + 1, true, 'Verifica') $$,
  '22023', null, 'La data di verifica non può essere nel futuro');
select throws_ok(
  $$ select public.salva_servizio_trasporto((select id from nuovo), 'taxi', 'Taxi di prova',
       'milano', '+39021234567', null, null, 14::smallint, 60::smallint,
       'http://comune.milano.it/taxi', current_date, true, 'Verifica') $$,
  '23514', null, 'La fonte deve essere un link https');

-- Una voce disattivata o 18+ non compare ai minorenni (R-04).
select public.salva_servizio_trasporto((select id from nuovo), 'taxi', 'Taxi di prova', 'milano',
       '+39021234567', null, null, 18::smallint, 60::smallint, 'https://comune.milano.it/taxi',
       current_date, true, 'Solo per maggiorenni');
select is(
  (select count(*)::int from public.azioni_moderazione
   where tipo_oggetto = 'servizio_trasporto' and oggetto_id = (select id from nuovo)),
  2, 'R-69: anche la modifica è registrata'
);
select ok((select count(*) from public.registro_moderazione('servizio_trasporto', (select id from nuovo))) = 2,
          'Il registro della voce si legge dall''area di moderazione');

select tests.autentica_come('minore_17');
select ok(not exists (select 1 from public.servizi_trasporto where nome = 'Taxi di prova'),
          'R-04: una voce portata a 18+ sparisce per i minorenni');
select tests.autentica_come('adulto_18');
select ok(exists (select 1 from public.servizi_trasporto where nome = 'Taxi di prova'),
          'R-04: la stessa voce resta visibile ai maggiorenni');
select tests.esci();

select * from finish();
rollback;
