-- caricamenti_flyer, bucket flyer-caricati, RPC della coda dei flyer (DATA_MODEL.md §5.3, §6).
-- Regole: R-06, R-20, R-23, R-51, R-54, R-55, R-69.
begin;
select plan(62);

create function tests.c(n text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-0000000c' || lpad(n, 4, '0'))::uuid;
$$;
create function tests.percorso(utente text, n text) returns text language sql stable as $$
  select tests.id(utente)::text || '/' || tests.c(n)::text || '.jpg';
$$;
grant execute on function tests.c(text), tests.percorso(text, text) to authenticated, noxa_worker;
grant noxa_worker to postgres;
grant usage on schema tests to noxa_worker;
grant execute on function tests.id(text) to noxa_worker;

-- ---------------------------------------------------------------------------------------------
-- Inserimento (R-54)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select lives_ok(
  $$ insert into public.caricamenti_flyer (id, utente_id, storage_path)
     values (tests.c('1'), tests.id('minore_14'), tests.percorso('minore_14', '1')) $$,
  'R-54: un utente di 14 anni carica un flyer nella propria cartella'
);
select throws_ok(
  $$ insert into public.caricamenti_flyer (utente_id, storage_path)
     values (tests.id('minore_14'), tests.percorso('minore_15', '2')) $$,
  '42501', null,
  'R-54: non si carica nella cartella di un altro'
);
select throws_ok(
  $$ insert into public.caricamenti_flyer (utente_id, storage_path)
     values (tests.id('minore_15'), tests.percorso('minore_15', '2')) $$,
  '42501', null,
  'Non si carica a nome di un altro'
);
select throws_ok(
  $$ insert into public.caricamenti_flyer (utente_id, storage_path, stato)
     values (tests.id('minore_14'), tests.percorso('minore_14', '3'), 'approvato') $$,
  '42501', null,
  'R-51: lo stato iniziale non si sceglie'
);
select tests.esci();
select is(
  (select count(*)::int from public.coda_job
   where tipo = 'analizza_flyer' and payload ->> 'caricamento_id' = tests.c('1')::text),
  1,
  'Il caricamento accoda la sua analisi'
);

select tests.autentica_come('minore_14');
select lives_ok(
  $$ insert into public.caricamenti_flyer (utente_id, storage_path)
     select tests.id('minore_14'), tests.percorso('minore_14', n::text)
     from generate_series(10, 18) n $$,
  'R-54: fino a 10 flyer in 24 ore'
);
select throws_ok(
  $$ insert into public.caricamenti_flyer (utente_id, storage_path)
     values (tests.id('minore_14'), tests.percorso('minore_14', '19')) $$,
  'NX027', null,
  'R-54: l''undicesimo flyer in 24 ore è rifiutato'
);
select is((select rimasti from public.flyer_disponibili()), 0, 'Nessun caricamento disponibile');
select ok((select prossimo_il > now() from public.flyer_disponibili()),
          'Si sa quando si libera il prossimo caricamento');
delete from public.caricamenti_flyer where storage_path = tests.percorso('minore_14', '18');
select throws_ok(
  $$ insert into public.caricamenti_flyer (utente_id, storage_path)
     values (tests.id('minore_14'), tests.percorso('minore_14', '19')) $$,
  'NX027', null,
  'R-54: cancellare una richiesta non libera un caricamento'
);

-- ---------------------------------------------------------------------------------------------
-- Lettura (R-69)
-- ---------------------------------------------------------------------------------------------
select is((select count(*)::int from public.caricamenti_flyer), 9, 'Il titolare vede i propri flyer');
select throws_ok(
  $$ select risultato_estrazione from public.caricamenti_flyer $$,
  '42501', null,
  'L''utente non legge l''output del modello'
);
select tests.autentica_come('minore_15');
select is_empty($$ select 1 from public.caricamenti_flyer $$, 'Non si vedono i flyer degli altri (15 anni)');
select tests.autentica_come('adulto_21');
select is_empty($$ select 1 from public.caricamenti_flyer $$, 'Non si vedono i flyer degli altri (21 anni)');
select tests.autentica_come('moderatore');
select is_empty($$ select 1 from public.caricamenti_flyer $$,
                'R-69: i moderatori leggono i flyer solo dalla coda, senza chi li ha caricati');
select throws_ok($$ select utente_id from public.caricamenti_flyer $$, '42501', null,
                 'R-69: nessuno legge chi ha caricato un flyer');
select ok(
  pg_get_function_result('public.coda_flyer()'::regprocedure) !~ 'utente',
  'R-69: la coda dei flyer non restituisce chi li ha caricati'
);

-- ---------------------------------------------------------------------------------------------
-- Worker: analisi ed esiti automatici (R-51)
-- ---------------------------------------------------------------------------------------------
select tests.esci();
set local role noxa_worker;
select lives_ok(
  $$ update public.caricamenti_flyer set stato = 'in_revisione', confidenza = 0.42
     where id = tests.c('1') $$,
  'Il worker registra l''analisi'
);
select throws_ok(
  $$ update public.caricamenti_flyer set stato = 'approvato' where id = tests.c('1') $$,
  'NX035', null,
  'R-51: il worker non approva un flyer'
);
select throws_ok(
  $$ update public.caricamenti_flyer set stato = 'unito', evento_id = '00000000-0000-4000-8000-00000000e010'
     where id = tests.c('1') $$,
  'NX035', null,
  'R-51: il worker unisce un flyer solo a un evento pubblicato'
);
select lives_ok(
  $$ update public.caricamenti_flyer set stato = 'unito', evento_id = '00000000-0000-4000-8000-00000000e002'
     where storage_path = tests.percorso('minore_14', '10') $$,
  'Il worker unisce un flyer a un evento già pubblicato'
);
select lives_ok(
  $$ update public.caricamenti_flyer set stato = 'rifiutato',
       motivo_rifiuto = 'L''immagine non sembra un flyer di un evento.'
     where storage_path = tests.percorso('minore_14', '11') $$,
  'Il worker rifiuta un''immagine che non è un flyer'
);
select throws_ok(
  $$ update public.caricamenti_flyer set utente_id = null where id = tests.c('1') $$,
  '42501', null,
  'Il worker non cambia chi ha caricato il flyer'
);
reset role;
select is(
  (select array_agg(dati ->> 'esito' order by dati ->> 'esito') from public.notifiche
   where utente_id = tests.id('minore_14') and tipo = 'esito_moderazione'),
  array['flyer_rifiutato', 'flyer_unito'],
  'R-53: gli esiti automatici arrivano a chi ha caricato'
);
select is(
  (select count(*)::int from public.azioni_moderazione
   where tipo_oggetto = 'caricamento_flyer' and moderatore_id is null),
  2,
  'Le decisioni automatiche sono nel registro come "Sistema"'
);

-- ---------------------------------------------------------------------------------------------
-- decidi_flyer (R-06, R-21, R-23, R-51)
-- ---------------------------------------------------------------------------------------------
-- Un flyer di adulto_20 in revisione con l'evento creato dal worker, uno senza locale risolto.
insert into public.caricamenti_flyer (id, utente_id, storage_path)
values (tests.c('20'), tests.id('adulto_20'), tests.percorso('adulto_20', '20')),
       (tests.c('21'), tests.id('adulto_20'), tests.percorso('adulto_20', '21')),
       (tests.c('22'), tests.id('adulto_20'), tests.percorso('adulto_20', '22')),
       (tests.c('23'), tests.id('adulto_20'), tests.percorso('adulto_20', '23'));
insert into public.eventi (id, locale_id, titolo, inizio, stato)
values ('00000000-0000-4000-8000-0000000ef020', '00000000-0000-4000-8000-00000000c003', 'Dal flyer',
        now() + interval '3 days', 'in_revisione'),
       ('00000000-0000-4000-8000-0000000ef022', '00000000-0000-4000-8000-00000000c003', 'Da unire',
        now() + interval '3 days', 'in_revisione');
insert into public.eventi_fonti (evento_id, caricamento_flyer_id, tipo_origine)
values ('00000000-0000-4000-8000-0000000ef020', tests.c('20'), 'flyer'),
       ('00000000-0000-4000-8000-0000000ef022', tests.c('22'), 'flyer');
update public.caricamenti_flyer set stato = 'in_revisione', evento_id = '00000000-0000-4000-8000-0000000ef020'
where id = tests.c('20');
update public.caricamenti_flyer set stato = 'in_revisione', evento_id = '00000000-0000-4000-8000-0000000ef022'
where id = tests.c('22');
update public.caricamenti_flyer set stato = 'in_revisione' where id in (tests.c('21'), tests.c('23'));

create function tests.dati_flyer(eta int, dichiarata boolean, alcol boolean, conferme boolean)
returns jsonb language sql as $$
  select jsonb_build_object(
    'titolo', 'Notte dal flyer', 'locale_id', '00000000-0000-4000-8000-00000000c003',
    'inizio', now() + interval '3 days', 'fine', now() + interval '3 days 5 hours',
    'eta_minima', eta, 'eta_minima_dichiarata', dichiarata, 'riferimenti_alcol', alcol,
    'generi', jsonb_build_array('techno'), 'artisti', jsonb_build_array('Nera Vale'),
    'prezzo_min_centesimi', 1000, 'confrontato', conferme, 'immagine_adatta', conferme,
    'pubblica_immagine', true);
$$;
grant execute on function tests.dati_flyer(int, boolean, boolean, boolean) to authenticated;

select tests.autentica_come('adulto_21');
select throws_ok($$ select public.coda_flyer() $$, '42501', null, 'R-06: la coda dei flyer è dei moderatori');
select tests.autentica_come('moderatore_senza_mfa');
select throws_ok(
  $$ select public.decidi_flyer(tests.c('20'), 'approva', tests.dati_flyer(18, true, true, true)) $$,
  '42501', null,
  'R-06: senza due fattori non si decide un flyer'
);
select tests.autentica_come('moderatore');
select is((select count(*)::int from public.coda_flyer()), 5, 'La coda contiene i flyer in revisione');
select throws_ok(
  $$ select public.decidi_flyer(tests.c('20'), 'approva', tests.dati_flyer(18, true, true, false)) $$,
  'NX034', null,
  'R-51: senza le conferme del moderatore non si pubblica'
);
select throws_ok(
  $$ select public.decidi_flyer(tests.c('20'), 'approva', tests.dati_flyer(16, true, false, true)) $$,
  'NX021', null,
  'Sotto i 18 anni serve la motivazione'
);
select throws_ok(
  $$ select public.decidi_flyer(tests.c('20'), 'approva',
       tests.dati_flyer(18, true, true, true) - 'riferimenti_alcol') $$,
  '22023', null,
  'R-23: i riferimenti all''alcol sono una scelta esplicita'
);
select lives_ok(
  $$ select public.decidi_flyer(tests.c('20'), 'approva', tests.dati_flyer(18, true, true, true)) $$,
  'Il moderatore approva e pubblica il flyer'
);
select is(
  (select stato::text || ',' || riferimenti_alcol::text from public.eventi
   where id = '00000000-0000-4000-8000-0000000ef020'),
  'pubblicato,true',
  'L''evento è pubblicato con i campi corretti dal moderatore'
);
select tests.esci();
select is(
  (select count(*)::int from public.coda_job
   where tipo = 'copia_immagine_flyer' and payload ->> 'caricamento_id' = tests.c('20')::text),
  1,
  'La copertina approvata si copia con il job del worker'
);
select tests.autentica_come('moderatore');
select throws_ok(
  $$ select public.decidi_flyer(tests.c('20'), 'rifiuta', '{}', 'Già deciso') $$,
  'NX025', null,
  'Un flyer già deciso non si decide di nuovo'
);
select lives_ok(
  $$ select public.decidi_flyer(tests.c('21'), 'approva', tests.dati_flyer(16, false, false, true)) $$,
  'Senza evento creato dal worker (locale non riconosciuto) l''approvazione lo crea'
);
select tests.esci();
select is(
  (select e.eta_minima from public.caricamenti_flyer c join public.eventi e on e.id = c.evento_id
   where c.id = tests.c('21')),
  18::smallint,
  'R-21: un''età non dichiarata sul flyer diventa 18'
);
select tests.autentica_come('minore_17');
select is_empty($$ select 1 from public.eventi where id = '00000000-0000-4000-8000-0000000ef020' $$,
                'R-23: un evento da flyer con riferimenti all''alcol non si vede a 17 anni');
select tests.autentica_come('adulto_18');
select isnt_empty($$ select 1 from public.eventi where id = '00000000-0000-4000-8000-0000000ef020' $$,
                  'Lo stesso evento si vede a 18 anni');

select tests.autentica_come('moderatore');
select throws_ok(
  $$ select public.decidi_flyer(tests.c('22'), 'unisci', '{}', null, '00000000-0000-4000-8000-00000000e010') $$,
  '22023', null,
  'R-51: si unisce solo a un evento pubblicato'
);
select lives_ok(
  $$ select public.decidi_flyer(tests.c('22'), 'unisci', '{}', null, '00000000-0000-4000-8000-00000000e001') $$,
  'Il moderatore unisce il flyer a un evento già pubblicato'
);
select is_empty($$ select 1 from public.eventi where id = '00000000-0000-4000-8000-0000000ef022' $$,
                'L''evento in revisione nato dal flyer unito sparisce');
select tests.esci();
select is(
  (select count(*)::int from public.eventi_fonti
   where evento_id = '00000000-0000-4000-8000-00000000e001' and caricamento_flyer_id = tests.c('22')),
  1,
  'R-51: il flyer unito aggiunge solo la fonte'
);
select tests.autentica_come('moderatore');
select throws_ok(
  $$ select public.decidi_flyer(tests.c('23'), 'rifiuta', '{}', ' ') $$,
  'NX021', null,
  'Un rifiuto chiede il motivo'
);
select lives_ok(
  $$ select public.decidi_flyer(tests.c('23'), 'rifiuta', '{}', 'Evento già passato.') $$,
  'Il moderatore rifiuta con il motivo'
);
select tests.esci();
select is(
  (select array_agg(dati ->> 'esito' order by dati ->> 'esito') from public.notifiche
   where utente_id = tests.id('adulto_20') and tipo = 'esito_moderazione'),
  array['flyer_pubblicato', 'flyer_pubblicato', 'flyer_rifiutato', 'flyer_unito'],
  'R-53: ogni decisione arriva a chi ha caricato'
);
select is(
  (select dati ->> 'motivazione' from public.notifiche
   where utente_id = tests.id('adulto_20') and dati ->> 'esito' = 'flyer_rifiutato'),
  'Evento già passato.',
  'Il rifiuto arriva con il motivo'
);
select is(
  (select count(*)::int from public.azioni_moderazione
   where tipo_oggetto = 'caricamento_flyer' and oggetto_id in (tests.c('20'), tests.c('21'), tests.c('22'), tests.c('23'))
     and moderatore_id = tests.id('moderatore')),
  4,
  'Ogni decisione è nel registro con il moderatore'
);

-- ---------------------------------------------------------------------------------------------
-- Cancellazione e escalation (R-55)
-- ---------------------------------------------------------------------------------------------
insert into public.caricamenti_flyer (id, utente_id, storage_path)
values (tests.c('30'), tests.id('adulto_21'), tests.percorso('adulto_21', '30')),
       (tests.c('31'), tests.id('adulto_21'), tests.percorso('adulto_21', '31'));
insert into public.eventi (id, locale_id, titolo, inizio, stato)
values ('00000000-0000-4000-8000-0000000ef030', '00000000-0000-4000-8000-00000000c003', 'Ritirato',
        now() + interval '3 days', 'in_revisione');
insert into public.eventi_fonti (evento_id, caricamento_flyer_id, tipo_origine)
values ('00000000-0000-4000-8000-0000000ef030', tests.c('30'), 'flyer');
update public.caricamenti_flyer set stato = 'in_revisione', evento_id = '00000000-0000-4000-8000-0000000ef030'
where id = tests.c('30');
update public.caricamenti_flyer set stato = 'in_revisione' where id = tests.c('31');

select tests.autentica_come('adulto_21');
delete from public.caricamenti_flyer where id = tests.c('30');
select tests.esci();
select is_empty($$ select 1 from public.eventi where id = '00000000-0000-4000-8000-0000000ef030' $$,
                'Cancellare la richiesta porta via l''evento in revisione nato solo da lei');
select isnt_empty($$ select 1 from public.eventi where id = '00000000-0000-4000-8000-0000000ef020' $$,
                  'Un evento già pubblicato resta');

select tests.autentica_come('moderatore');
select throws_ok(
  $$ select public.escalation_flyer(tests.c('31'), 'Contenuto illecito', 'conferma') $$,
  'NX032', null,
  'R-55: l''escalation chiede la parola di conferma'
);
select lives_ok(
  $$ select public.escalation_flyer(tests.c('31'), 'Contenuto illecito', 'escalation') $$,
  'R-55: escalation del flyer'
);
select tests.esci();
select is((select stato_account::text from public.profili where id = tests.id('adulto_21')), 'sospeso',
          'R-55: l''account di chi ha caricato è sospeso');
select ok((select conservazione_legale from public.caricamenti_flyer where id = tests.c('31')),
          'R-55: il flyer è conservato come prova');
select is_empty(
  $$ select 1 from public.notifiche where utente_id = tests.id('adulto_21')
       and dati ->> 'caricamento_id' = tests.c('31')::text $$,
  'R-55: nessuna comunicazione all''account coinvolto'
);
select tests.autentica_come('adulto_21');
select is_empty($$ delete from public.caricamenti_flyer where id = tests.c('31') returning 1 $$,
                'R-55: la prova non si cancella');

-- ---------------------------------------------------------------------------------------------
-- Bucket flyer-caricati (R-54, R-69)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('flyer-caricati', tests.percorso('minore_16', '40'), tests.id('minore_16')::text) $$,
  'R-54: si carica l''immagine nella propria cartella'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('flyer-caricati', tests.percorso('minore_15', '41')) $$,
  '42501', null,
  'R-54: non si carica nella cartella di un altro'
);
select tests.autentica_come('minore_15');
select is_empty($$ select 1 from storage.objects where bucket_id = 'flyer-caricati' $$,
                'Non si vedono le immagini degli altri');
select tests.autentica_come('moderatore');
select isnt_empty($$ select 1 from storage.objects where bucket_id = 'flyer-caricati' $$,
                  'R-51: i moderatori vedono le immagini da controllare');
select tests.autentica_come('moderatore_senza_mfa');
select is_empty($$ select 1 from storage.objects where bucket_id = 'flyer-caricati' $$,
                'R-06: senza due fattori un moderatore non vede le immagini');
select tests.autentica_come('minore_16');
select throws_ok(
  $$ do $d$ begin
       for n in 42..52 loop
         insert into storage.objects (bucket_id, name)
         values ('flyer-caricati', tests.percorso('minore_16', n::text));
       end loop;
     end $d$ $$,
  '42501', null,
  'R-54: al massimo 10 immagini al giorno anche nello storage'
);

select * from finish();
rollback;
