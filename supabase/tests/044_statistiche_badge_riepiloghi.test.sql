-- mie_statistiche, badge, badge_utente, riepiloghi_annuali (DATA_MODEL.md §5.6, §5.10): solo il
-- titolare, moderatori compresi; catalogo dei badge conforme a R-41; riepilogo senza altri
-- utenti né nomi scritti a mano (R-42) e senza spesa (R-43); aggiornamento una volta al giorno.
-- Regole: R-40, R-41, R-42, R-43, R-64, R-69. Funzioni: assegna_badge, calcola_riepilogo,
-- genera_riepiloghi, rigenera_riepilogo.
begin;
select plan(67);

-- ---------------------------------------------------------------------------------------------
-- Dati del diario (inseriti senza passare dalla RLS, con date fisse del 2025)
-- ---------------------------------------------------------------------------------------------
create function tests.voce11(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-0000001100' || lpad(n::text, 2, '0'))::uuid;
$$;
grant execute on function tests.voce11(int) to authenticated;

-- minore_16: 5 luoghi diversi scritti a mano, uno per stagione più uno, tutti con le note.
insert into public.serate_tracker (id, utente_id, data_serata, nome_locale_libero, voto, note)
values
  (tests.voce11(1), tests.id('minore_16'), '2025-01-18', 'Festa da Luca', 3, 'Bella'),
  (tests.voce11(2), tests.id('minore_16'), '2025-04-12', 'Oratorio Centro', null, 'Concerto'),
  (tests.voce11(3), tests.id('minore_16'), '2025-07-05', 'Spiaggia Nord', 5, 'Mare'),
  (tests.voce11(4), tests.id('minore_16'), '2025-10-11', 'Piazza Grande', 4, 'Festa'),
  (tests.voce11(5), tests.id('minore_16'), '2025-10-25', 'Casa di Giulia', null, 'Compleanno');
insert into public.tracker_dj (serata_tracker_id, nome_dj) values
  (tests.voce11(1), 'Lanterna'), (tests.voce11(3), 'lanterna'), (tests.voce11(4), 'Nera Vox');
insert into public.tracker_spese (serata_tracker_id, categoria, importo_centesimi) values
  (tests.voce11(1), 'ingresso', 500), (tests.voce11(3), 'ingresso', 700),
  (tests.voce11(3), 'cibo', 300);
select tests.rendi_amici('minore_16', 'minore_17');
insert into public.tracker_amici (serata_tracker_id, amico_id) values
  (tests.voce11(1), tests.id('minore_17')), (tests.voce11(3), tests.id('minore_17'));

-- adulto_20: 5 serate nello stesso locale del catalogo, in primavera e in autunno.
insert into public.serate_tracker (id, utente_id, data_serata, locale_id, voto)
select tests.voce11(10 + n), tests.id('adulto_20'), date '2025-03-01' + (n * 45),
       '00000000-0000-4000-8000-00000000c001', n
from generate_series(1, 5) n;
insert into public.tracker_spese (serata_tracker_id, categoria, importo_centesimi) values
  (tests.voce11(11), 'alcolici', 1200), (tests.voce11(11), 'ingresso', 1000);

-- minore_14: solo 2 serate nel 2025.
insert into public.serate_tracker (id, utente_id, data_serata, nome_locale_libero) values
  (tests.voce11(21), tests.id('minore_14'), '2025-05-01', 'Parco'),
  (tests.voce11(22), tests.id('minore_14'), '2025-05-08', 'Parco');

-- Badge di prova per soli maggiorenni (R-41), con un criterio già raggiunto da tutti.
insert into public.badge (codice, nome, descrizione, criterio, solo_maggiorenni, ordine)
values ('prova_adulti', 'Prova adulti', 'Badge di prova.', '{"tipo": "serate", "soglia": 1}', true, 99);

-- ---------------------------------------------------------------------------------------------
-- Struttura, catalogo e R-41
-- ---------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.badge'::regclass), 'RLS su badge');
select ok((select relrowsecurity from pg_class where oid = 'public.badge_utente'::regclass), 'RLS su badge_utente');
select ok((select relrowsecurity from pg_class where oid = 'public.riepiloghi_annuali'::regclass), 'RLS su riepiloghi_annuali');
select is((select count(*)::int from public.badge where codice <> 'prova_adulti'), 10,
  'Catalogo di 10 badge (design/F-32-badge)');
select is_empty($$ select 1 from public.badge where solo_maggiorenni and codice <> 'prova_adulti' $$,
  'R-41: nessun badge del catalogo è per soli maggiorenni');
select throws_ok(
  $$ insert into public.badge (codice, nome, descrizione, criterio)
     values ('veloce', 'Veloce', 'x', '{"tipo": "serate", "soglia": 5, "giorni": 7}') $$,
  '23514', null, 'R-41: un criterio non può avere una finestra di tempo');
select throws_ok(
  $$ insert into public.badge (codice, nome, descrizione, criterio)
     values ('spendaccione', 'Spesa', 'x', '{"tipo": "spesa_totale", "soglia": 100}') $$,
  '23514', null, 'R-41: nessun tipo di criterio sulla spesa');
select throws_ok(
  $$ insert into public.badge (codice, nome, descrizione, criterio)
     values ('tardi', 'Tardi', 'x', '{"tipo": "rientro_dopo", "soglia": 4}') $$,
  '23514', null, 'R-41: nessun tipo di criterio sull''orario');

-- Catalogo visibile per età: 10 badge ai minorenni, 11 ai maggiorenni (R-41).
select tests.autentica_come('minore_14');
select is((select count(*)::int from public.badge), 10, 'R-41: 14 anni non vede il badge per adulti');
select tests.autentica_come('minore_15');
select is((select count(*)::int from public.badge), 10, 'R-41: 15 anni non vede il badge per adulti');
select tests.autentica_come('minore_16');
select is((select count(*)::int from public.badge), 10, 'R-41: 16 anni non vede il badge per adulti');
select tests.autentica_come('minore_17');
select is((select count(*)::int from public.badge), 10, 'R-41: 17 anni non vede il badge per adulti');
select tests.autentica_come('adulto_18');
select is((select count(*)::int from public.badge), 11, '18 anni vede anche il badge per adulti');
select tests.autentica_come('adulto_20');
select is((select count(*)::int from public.badge), 11, '20 anni vede anche il badge per adulti');
select tests.autentica_come('adulto_21');
select is((select count(*)::int from public.badge), 11, '21 anni vede anche il badge per adulti');
select throws_ok(
  $$ insert into public.badge (codice, nome, descrizione, criterio)
     values ('mio', 'Mio', 'x', '{"tipo": "serate", "soglia": 1}') $$,
  '42501', null, 'Un utente non aggiunge badge al catalogo');
select throws_ok(
  $$ insert into public.badge_utente (utente_id, badge_codice) values (tests.id('adulto_21'), 'cronista') $$,
  '42501', null, 'Un utente non si assegna un badge da solo');
select tests.esci();

-- ---------------------------------------------------------------------------------------------
-- Assegnazione
-- ---------------------------------------------------------------------------------------------
select ok(private.assegna_badge() >= 2, 'assegna_badge notifica almeno le due persone con i badge nuovi');
select set_eq(
  $$ select badge_codice from public.badge_utente where utente_id = tests.id('minore_16') $$,
  array['prima_pagina', 'esploratore_1', 'quattro_stagioni'],
  '16 anni: prima pagina, esploratore I (5 luoghi) e quattro stagioni');
select set_eq(
  $$ select badge_codice from public.badge_utente where utente_id = tests.id('adulto_20') $$,
  array['prima_pagina', 'di_casa', 'prova_adulti'],
  '20 anni: prima pagina, di casa (5 serate nello stesso locale) e il badge per adulti');
select is_empty(
  $$ select 1 from public.badge_utente where badge_codice = 'prova_adulti'
     and utente_id in (tests.id('minore_14'), tests.id('minore_16')) $$,
  'R-41: nessun badge per soli maggiorenni assegnato ai minorenni');
select is_empty(
  $$ select 1 from public.badge_utente where utente_id = tests.id('minore_16')
     and badge_codice in ('cronista', 'di_casa', 'cacciatore_dj', 'in_compagnia', 'esploratore_2') $$,
  'Sotto soglia nessun badge (5 note, DJ uguali senza maiuscole, 2 serate con amici)');
select is(
  (select dati from public.notifiche where utente_id = tests.id('minore_16') and tipo = 'badge_ottenuto'),
  jsonb_build_object('badge_codice', 'quattro_stagioni', 'nome', 'Quattro stagioni', 'quanti', 3),
  'Una sola notifica per persona con il badge più alto e il numero dei nuovi');
select is(private.assegna_badge(), 0, 'Un secondo giro non assegna né notifica di nuovo');
select is((select count(*)::int from public.notifiche
           where utente_id = tests.id('minore_16') and tipo = 'badge_ottenuto'), 1,
  'Nessuna notifica doppia');

-- RLS di badge_utente (R-69)
select tests.autentica_come('minore_16');
select is((select count(*)::int from public.badge_utente), 3, 'Il titolare vede i suoi 3 badge');
select tests.autentica_come('minore_17');
select is_empty($$ select 1 from public.badge_utente where utente_id = tests.id('minore_16') $$,
  'Un amico non vede i badge');
select tests.autentica_come('adulto_21');
select is_empty($$ select 1 from public.badge_utente where utente_id <> tests.id('adulto_21') $$,
  'Un adulto non vede i badge di altri');
select tests.autentica_come('moderatore');
select is_empty($$ select 1 from public.badge_utente $$, 'R-69: il moderatore non vede i badge');
select tests.autentica_come('moderatore_senza_mfa');
select is_empty($$ select 1 from public.badge_utente $$, 'R-69: nemmeno senza due fattori');
select tests.esci();

-- ---------------------------------------------------------------------------------------------
-- Statistiche (F-31)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select is((public.mie_statistiche(2025::smallint) ->> 'serate')::int, 5, 'Statistiche del 2025: 5 serate');
select is(public.mie_statistiche(2025::smallint) -> 'per_mese',
  '[1, 0, 0, 1, 0, 0, 1, 0, 0, 2, 0, 0]'::jsonb, 'Serate per mese, anche i mesi a zero');
select is(public.mie_statistiche(2025::smallint) -> 'dj' -> 0,
  '{"nome": "Lanterna", "serate": 2}'::jsonb, 'DJ uniti senza distinguere le maiuscole');
select is(public.mie_statistiche(2025::smallint) -> 'spese' -> 'totale_centesimi', '1500'::jsonb,
  'Spesa totale del periodo');
select is(public.mie_statistiche(null) -> 'per_anno', '[{"anno": 2025, "serate": 5}]'::jsonb,
  'Per sempre: serate per anno');
select is((public.mie_statistiche(2024::smallint) ->> 'serate')::int, 0, 'Un anno vuoto dà zero');
select tests.autentica_come('adulto_20');
select is(public.mie_statistiche(2025::smallint) -> 'locali',
  '[{"nome": "Club Binario 7", "serate": 5}]'::jsonb, 'Locali più frequenti dal catalogo');
select is((public.mie_statistiche(2025::smallint) ->> 'serate')::int, 5,
  'Ognuno conta solo le sue serate');
select tests.autentica_come('minore_17');
select is((public.mie_statistiche(2025::smallint) ->> 'serate')::int, 0,
  'L''amico indicato nel diario non vede le serate altrui');
select tests.autentica_come('moderatore');
select is((public.mie_statistiche(null) ->> 'serate')::int, 0, 'R-69: il moderatore non vede statistiche altrui');
select tests.esci();
select set_config('role', 'anon', true);
select throws_ok($$ select public.mie_statistiche(2025::smallint) $$, '42501', null,
  'anon non chiama mie_statistiche');
select throws_ok($$ select public.rigenera_mio_riepilogo() $$, '42501', null,
  'anon non chiama rigenera_mio_riepilogo');
select tests.esci();

-- ---------------------------------------------------------------------------------------------
-- Riepiloghi (F-33, R-42, R-43)
-- ---------------------------------------------------------------------------------------------
select is(private.calcola_riepilogo(tests.id('minore_14'), 2025::smallint), null,
  'Con meno di 3 serate nessun riepilogo');
select ok(private.calcola_riepilogo(tests.id('minore_16'), 2025::smallint) is not null,
  'Con 5 serate il riepilogo c''è');
select is((private.calcola_riepilogo(tests.id('minore_16'), 2025::smallint) ->> 'amici_diversi')::int, 1,
  'R-42: gli amici sono un numero');
select is((private.calcola_riepilogo(tests.id('minore_16'), 2025::smallint) ->> 'serate_con_amici')::int, 2,
  'Serate in compagnia contate');
select ok(position(tests.id('minore_17')::text in private.calcola_riepilogo(tests.id('minore_16'), 2025::smallint)::text) = 0
          and position('minore_17' in private.calcola_riepilogo(tests.id('minore_16'), 2025::smallint)::text) = 0,
  'R-42: nessun identificativo né username dell''amico');
select ok(private.calcola_riepilogo(tests.id('minore_16'), 2025::smallint)::text !~* 'Luca|Giulia|Festa da|Casa di',
  'R-42: i nomi di luoghi scritti a mano non compaiono');
select is(private.calcola_riepilogo(tests.id('minore_16'), 2025::smallint) -> 'locali_diversi', '5'::jsonb,
  'I luoghi scritti a mano sono solo contati');
select ok(not (private.calcola_riepilogo(tests.id('adulto_20'), 2025::smallint) ?| array['spese', 'spesa']),
  'R-43: nessuna spesa nel riepilogo');
select ok(private.calcola_riepilogo(tests.id('adulto_20'), 2025::smallint)::text !~* 'alcol',
  'R-42: nessun riferimento all''alcol');
select throws_ok(
  $$ insert into public.riepiloghi_annuali (utente_id, anno, dati)
     values (tests.id('adulto_21'), 2025, '{"serate": 3, "amici": ["marco"]}') $$,
  '23514', null, 'R-42: il formato non ammette campi per altri utenti');

select is(private.genera_riepiloghi(2025::smallint), 3, 'genera_riepiloghi elabora le 3 persone con serate nel 2025');
select set_eq($$ select utente_id from public.riepiloghi_annuali where anno = 2025 $$,
  array[tests.id('minore_16'), tests.id('adulto_20')], 'Riepiloghi solo per chi ha almeno 3 serate');
select is((select count(*)::int from public.notifiche
           where tipo = 'riepilogo_pronto' and dati = '{"anno": 2025}'), 2,
  'Notifica riepilogo_pronto per i riepiloghi nuovi');
select is(private.genera_riepiloghi(2025::smallint), 3, 'Un secondo giro rigenera');
select is((select count(*)::int from public.notifiche where tipo = 'riepilogo_pronto'), 2,
  'Il secondo giro non notifica di nuovo');

-- RLS di riepiloghi_annuali (R-69)
select tests.autentica_come('minore_16');
select is((select count(*)::int from public.riepiloghi_annuali), 1, 'Il titolare vede il suo riepilogo');
select throws_ok($$ update public.riepiloghi_annuali set dati = '{}' $$, '42501', null,
  'Il titolare non modifica il riepilogo a mano');
select tests.autentica_come('minore_17');
select is_empty($$ select 1 from public.riepiloghi_annuali $$, 'Un amico non vede il riepilogo');
select tests.autentica_come('moderatore');
select is_empty($$ select 1 from public.riepiloghi_annuali $$, 'R-69: il moderatore non vede i riepiloghi');

-- Aggiornamento: dal 1° dicembre al 31 gennaio, una volta al giorno.
select tests.esci();
select throws_ok($$ select private.rigenera_riepilogo(tests.id('minore_16'), '2026-03-10') $$,
  'NX062', null, 'A marzo il riepilogo non si aggiorna');
select throws_ok($$ select private.rigenera_riepilogo(tests.id('minore_16'), '2026-01-10') $$,
  'NX063', null, 'Già generato oggi o dopo: si aggiorna domani');
update public.riepiloghi_annuali set generato_il = '2025-12-01 03:00+00'
where utente_id = tests.id('minore_16') and anno = 2025;
select is((private.rigenera_riepilogo(tests.id('minore_16'), '2026-01-10') ->> 'serate')::int, 5,
  'A gennaio si aggiorna il riepilogo dell''anno appena chiuso');
select is(private.rigenera_riepilogo(tests.id('minore_14'), '2025-12-10'), null,
  'Con meno di 3 serate l''aggiornamento non crea un riepilogo');
select throws_ok($$ select private.rigenera_riepilogo(null, '2025-12-10') $$, '42501', null,
  'Senza utente nessun aggiornamento');

-- ---------------------------------------------------------------------------------------------
-- Esportazione (R-64)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select ok(public.esporta_miei_dati() ?& array['badge', 'riepiloghi_annuali', 'diario', 'checkin'],
  'R-64: l''esportazione contiene badge e riepiloghi');

select * from finish();
rollback;
