-- eventi, eventi_generi, eventi_fonti (DATA_MODEL.md §5.3). Regole: R-20, R-21, R-22, R-23.
-- Eventi del seed: e002, e011, e012 14+; e004, e006 (annullato), e009 16+; e001, e005 18+;
-- e003 18+ non dichiarata; e008 18+ con riferimenti all'alcol; e007 21+; e010 in revisione.
-- Serate passate per il diario: e101 16+, e102 18+ con riferimenti all'alcol, e103 21+.
begin;
select plan(51);

create function tests.e(n text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000e' || n)::uuid;
$$;

create function tests.eventi_visibili() returns uuid[] language sql as $$
  select coalesce(array_agg(id order by id), '{}') from public.eventi;
$$;

create function tests.attesi(variadic numeri text[]) returns uuid[] language sql as $$
  select array_agg(tests.e(n) order by tests.e(n)) from unnest(numeri) n;
$$;

-- ---------------------------------------------------------------------------------------------
-- R-20, R-21, R-23: ogni età vede solo gli eventi a cui può entrare
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select is(tests.eventi_visibili(), tests.attesi('002', '011', '012'),
          'R-20: chi ha 14 anni vede solo gli eventi 14+');
select tests.autentica_come('minore_15');
select is(tests.eventi_visibili(), tests.attesi('002', '011', '012'),
          'R-20: chi ha 15 anni non vede gli eventi 16+');
select tests.autentica_come('minore_16');
select is(tests.eventi_visibili(), tests.attesi('002', '004', '006', '009', '011', '012', '101'),
          'R-20: chi ha 16 anni vede 14+ e 16+, anche annullati');
select tests.autentica_come('minore_17');
select is(tests.eventi_visibili(), tests.attesi('002', '004', '006', '009', '011', '012', '101'),
          'R-20, R-21, R-23: chi ha 17 anni non vede i 18+, quelli senza età né quelli con alcol');
select tests.autentica_come('adulto_18');
select is(tests.eventi_visibili(),
          tests.attesi('001', '002', '003', '004', '005', '006', '008', '009', '011', '012', '101', '102'),
          'R-20, R-23: chi ha 18 anni vede i 18+ e gli eventi con riferimenti all''alcol');
select tests.autentica_come('adulto_20');
select is(tests.eventi_visibili(),
          tests.attesi('001', '002', '003', '004', '005', '006', '008', '009', '011', '012', '101', '102'),
          'R-20: chi ha 20 anni non vede gli eventi 21+');
select tests.autentica_come('adulto_21');
select is(tests.eventi_visibili(),
          tests.attesi('001', '002', '003', '004', '005', '006', '007', '008', '009', '011', '012', '101',
                       '102', '103'),
          'R-20: chi ha 21 anni vede anche i 21+, mai gli eventi in revisione');
select tests.autentica_come('moderatore_senza_mfa');
select is(tests.eventi_visibili(),
          tests.attesi('001', '002', '003', '004', '005', '006', '007', '008', '009', '011', '012', '101',
                       '102', '103'),
          'R-06: senza due fattori un moderatore vede solo il catalogo pubblicato');
select tests.autentica_come('moderatore');
select is(tests.eventi_visibili(),
          tests.attesi('001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011',
                       '012', '101', '102', '103'),
          'Un moderatore con due fattori vede anche gli eventi in revisione');

-- private.evento_visibile_a applica la stessa regola della policy, per ogni utente del seed.
select tests.esci();
select is_empty(
  $$ select u.username, e.id
     from public.profili u cross join public.eventi e
     where u.username in ('minore_14', 'minore_15', 'minore_16', 'minore_17', 'adulto_18',
                          'adulto_20', 'adulto_21')
       and private.evento_visibile_a(e.id, u.id) <> (
         e.stato in ('pubblicato', 'annullato')
         and e.eta_minima <= private.eta_di(u.id)
         and (not e.riferimenti_alcol or private.eta_di(u.id) >= 18)) $$,
  'R-20, R-23: evento_visibile_a coincide con la policy per tutte le età'
);
select ok(not private.evento_visibile_a(tests.e('007'), tests.id('adulto_20')),
          'R-20: evento_visibile_a nega il 21+ a chi ha 20 anni');
select ok(not private.evento_visibile_a(tests.e('008'), tests.id('minore_17')),
          'R-23: evento_visibile_a nega l''evento con alcol a chi ha 17 anni');
select ok(private.evento_visibile_a(tests.e('008'), tests.id('adulto_18')),
          'R-23: evento_visibile_a mostra l''evento con alcol a chi ha 18 anni');

-- ---------------------------------------------------------------------------------------------
-- R-21: età non dichiarata = 18
-- ---------------------------------------------------------------------------------------------
select is((select eta_minima from public.eventi where id = tests.e('003')), 18::smallint,
          'R-21: l''evento senza età dichiarata vale 18');
select throws_ok(
  $$ insert into public.eventi (locale_id, titolo, inizio, eta_minima, eta_minima_dichiarata, stato)
     values ('00000000-0000-4000-8000-00000000c001', 'Prova', now() + interval '1 day', 16, false,
             'pubblicato') $$,
  '23514', null,
  'R-21: un''età diversa da 18 deve essere dichiarata'
);
insert into public.eventi (locale_id, titolo, inizio)
values ('00000000-0000-4000-8000-00000000c001', 'Prova predefinita', now() + interval '1 day'),
       ('00000000-0000-4000-8000-00000000c001', 'Prova notte', timestamptz '2026-10-24 02:30:00+02');
select is(
  (select row(eta_minima, eta_minima_dichiarata, stato)::text from public.eventi
   where titolo = 'Prova predefinita'),
  '(18,f,in_revisione)',
  'R-21, R-51: un evento nuovo è 18+ non dichiarato e in revisione'
);
select is(
  (select data_serata from public.eventi where titolo = 'Prova notte'),
  date '2026-10-23',
  'Un evento che inizia alle 02:30 appartiene alla serata del giorno prima'
);
select throws_ok(
  $$ insert into public.eventi (locale_id, titolo, inizio, fine)
     values ('00000000-0000-4000-8000-00000000c001', 'Prova', now() + interval '1 day', now()) $$,
  '23514', null,
  'La fine viene dopo l''inizio'
);

-- ---------------------------------------------------------------------------------------------
-- Scrittura: gli utenti non scrivono, i moderatori correggono, il worker raccoglie
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_21');
select throws_ok(
  $$ insert into public.eventi (locale_id, titolo, inizio)
     values ('00000000-0000-4000-8000-00000000c001', 'Evento falso', now() + interval '1 day') $$,
  '42501', null,
  'Un utente non crea eventi'
);
select is_empty(
  $$ update public.eventi set titolo = 'Cambiato' where id = tests.e('001') returning id $$,
  'Un utente non modifica gli eventi'
);
select throws_ok(
  $$ delete from public.eventi where id = tests.e('001') $$,
  '42501', null,
  'Un utente non elimina gli eventi'
);
select tests.autentica_come('moderatore_senza_mfa');
select is_empty(
  $$ update public.eventi set stato = 'pubblicato' where id = tests.e('010') returning id $$,
  'R-06: senza due fattori un moderatore non approva eventi'
);
select tests.autentica_come('moderatore');
select throws_ok(
  $$ update public.eventi set stato = 'pubblicato' where id = tests.e('010') $$,
  'NX020', null,
  'Lo stato di un evento cambia solo con la RPC che registra la decisione'
);
select lives_ok(
  $$ select public.cambia_stato_evento(tests.e('010'), 'pubblicato', null) $$,
  'Un moderatore con due fattori approva un evento'
);

-- R-22 con il ruolo del worker (ADR-0003)
select tests.esci();
-- L'appartenenza al ruolo del worker vale solo dentro questa transazione di test.
grant noxa_worker to postgres;
grant usage on schema tests to noxa_worker;
grant execute on function tests.e(text) to noxa_worker;
set local role noxa_worker;
select throws_ok(
  $$ update public.eventi set eta_minima = 16 where id = tests.e('001') $$,
  'NX017', null,
  'R-22: il worker non abbassa un''età dichiarata'
);
select throws_ok(
  $$ update public.eventi set eta_minima_dichiarata = false where id = tests.e('004') $$,
  'NX017', null,
  'R-22: il worker non rende "non dichiarata" un''età dichiarata'
);
select lives_ok(
  $$ update public.eventi set eta_minima = 21 where id = tests.e('005') $$,
  'R-22: il worker alza un''età dichiarata'
);
select lives_ok(
  $$ update public.eventi set eta_minima = 16, eta_minima_dichiarata = true where id = tests.e('003') $$,
  'R-21: la prima età dichiarata sostituisce il 18 predefinito, anche più bassa'
);
select throws_ok(
  $$ update public.eventi set riferimenti_alcol = false where id = tests.e('008') $$,
  'NX018', null,
  'R-22, R-23: il worker non toglie i riferimenti all''alcol'
);
select lives_ok(
  $$ update public.eventi set riferimenti_alcol = true where id = tests.e('009') $$,
  'R-23: il worker segna i riferimenti all''alcol'
);
select lives_ok(
  $$ insert into public.eventi (locale_id, titolo, inizio, eta_minima, eta_minima_dichiarata)
     values ('00000000-0000-4000-8000-00000000c002', 'Dal worker', now() + interval '2 days', 16, true) $$,
  'Il worker crea eventi'
);
select throws_ok(
  $$ delete from public.eventi where id = tests.e('001') $$,
  '42501', null,
  'Il worker non elimina eventi'
);
reset role;

select tests.autentica_come('moderatore');
select throws_ok(
  $$ update public.eventi set eta_minima = 18 where id = tests.e('005') $$,
  'NX020', null,
  'R-22: anche un moderatore abbassa un''età solo con una motivazione registrata'
);
select throws_ok(
  $$ update public.eventi set riferimenti_alcol = false where id = tests.e('009') $$,
  'NX020', null,
  'R-23: anche un moderatore toglie l''alcol solo con una motivazione registrata'
);
select throws_ok(
  $$ select public.correggi_eta_alcol_evento(tests.e('005'), 18::smallint, true, false, ' ') $$,
  'NX021', null,
  'R-22: la correzione dell''età chiede la motivazione'
);
select lives_ok(
  $$ select public.correggi_eta_alcol_evento(tests.e('005'), 18::smallint, true, false,
                                             'Il locale ha confermato via email.') $$,
  'R-22: un moderatore abbassa un''età dichiarata con la motivazione'
);
select lives_ok(
  $$ select public.correggi_eta_alcol_evento(tests.e('009'), 18::smallint, false, false,
                                             'La parola era il nome di un artista.') $$,
  'R-22: un moderatore toglie i riferimenti all''alcol con la motivazione'
);
select is(
  (select count(*)::int from public.azioni_moderazione
   where oggetto_id in (tests.e('005'), tests.e('009')) and azione = 'correggi_eta_alcol'
     and moderatore_id = tests.id('moderatore')),
  2,
  'R-22: le correzioni di età e alcol restano nel registro'
);

-- ---------------------------------------------------------------------------------------------
-- eventi_generi ed eventi_fonti: visibili come l'evento
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select is_empty(
  $$ select 1 from public.eventi_generi where evento_id in (tests.e('001'), tests.e('008')) $$,
  'R-20, R-23: chi ha 16 anni non vede i generi degli eventi 18+ e con alcol'
);
select isnt_empty(
  $$ select 1 from public.eventi_generi where evento_id = tests.e('004') $$,
  'I generi di un evento visibile si vedono'
);
select is_empty(
  $$ select 1 from public.eventi_fonti where evento_id = tests.e('001') $$,
  'R-20: chi ha 16 anni non vede le fonti di un evento 18+'
);
select isnt_empty(
  $$ select url_originale from public.eventi_fonti where evento_id = tests.e('004') $$,
  'La fonte di un evento visibile si vede'
);
select throws_ok(
  $$ select caricamento_flyer_id from public.eventi_fonti $$,
  '42501', null,
  'Chi ha caricato un flyer resta anonimo: la colonna non si legge'
);
select throws_ok(
  $$ insert into public.eventi_generi (evento_id, genere_codice) values (tests.e('004'), 'techno') $$,
  '42501', null,
  'Un utente non cambia i generi di un evento'
);
select isnt_empty($$ select 1 from public.generi_musicali where codice = 'techno' $$,
                  'I generi musicali si leggono');
select throws_ok(
  $$ insert into public.generi_musicali (codice, nome) values ('nuovo', 'nuovo') $$,
  '42501', null,
  'I generi musicali cambiano solo con le migrazioni'
);

-- ---------------------------------------------------------------------------------------------
-- Segnalazioni di eventi (R-50)
-- ---------------------------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('minore_16'), 'evento', tests.e('004'), 'dati_errati') $$,
  'R-50: si segnala un evento visibile'
);
select throws_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('minore_16'), 'evento', tests.e('001'), 'evento_falso') $$,
  '42501', null,
  'R-20: non si segnala un evento che non si può vedere'
);
select is(
  (select descrizione from public.mie_segnalazioni() where tipo_oggetto = 'evento'),
  'Indie al Binario',
  'Le mie segnalazioni mostrano il titolo dell''evento'
);

-- Il ruolo anonimo non legge nulla (R-07).
select tests.esci();
set local role anon;
select throws_ok($$ select 1 from public.eventi $$, '42501', null, 'R-07: anon non legge gli eventi');
select throws_ok($$ select * from public.cerca_eventi() $$, '42501', null,
                 'R-07: anon non cerca eventi');
reset role;

select * from finish();
rollback;
